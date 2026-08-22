import base64
import json
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    # Handle missing env gracefully during tests/builds
    # In production, this will crash the app if missing
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def _aal_claim(token: str) -> str:
    """Read the `aal` claim out of the access token's payload.

    No signature check here — verify_token already proved this token is
    genuine by round-tripping it through Supabase's own /auth/v1/user, so this
    is just reading a field out of a value already established as trustworthy,
    not an independent verification step.
    """
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("aal", "aal1")
    except Exception:
        return "aal1"


def verify_token(token: str) -> str:
    """Verifies a JWT via Supabase and returns the user_id.

    Also enforces MFA step-up: if the account has a verified TOTP factor, the
    token must carry aal2 (i.e. the holder actually completed the TOTP
    challenge), not just aal1 (password only). Without this, a stolen
    password alone would be enough to call the API directly even though the
    account has 2FA enabled — the frontend's login-time MFA prompt only
    guards the UI, not the token itself.
    """
    if not supabase:
        raise ValueError("Supabase is not configured.")
    try:
        # Get the user using the access token
        user_response = supabase.auth.get_user(token)
        if not (user_response and user_response.user):
            raise Exception("Invalid token")

        has_verified_factor = any(
            f.status == "verified" for f in (user_response.user.factors or [])
        )
        if has_verified_factor and _aal_claim(token) != "aal2":
            raise Exception("MFA verification required.")

        return user_response.user.id
    except Exception as e:
        raise Exception(f"Unauthorized: {str(e)}")

def _client_for(token: str) -> Client:
    """A fresh client per call, authenticated as the caller.

    The shared `supabase` client only ever carries the anon key, so table/storage
    calls made through it run as the anonymous role and get rejected by RLS
    policies keyed on auth.uid(). Attaching the caller's own JWT here makes
    those calls run as that user instead, which is what the policies expect.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not token:
        return None
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.options.headers["Authorization"] = f"Bearer {token}"
    return client

def save_analysis(user_id: str, token: str, record: dict) -> None:
    """Saves a single analysis record to the Supabase database."""
    client = _client_for(token)
    if not client:
        return
        
    analysis_id = record.get("analysis_id")
    patient_name = record.get("patient", {}).get("name")
    classification = record.get("meniscus", {}).get("assessment", {}).get("classification")
    
    # Optional: Upload base64 variants to Supabase Storage and remove from record
    variants_data = record.get("images", {}).get("variants_data", {})
    variants = record.get("images", {}).get("variants", {})
    
    # We will upload the base64 variants to the 'images' bucket so they persist!
    import base64
    for key, b64_data in variants_data.items():
        if key in variants:
            filename = variants[key]
            if b64_data.startswith("data:image"):
                b64_data = b64_data.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(b64_data)
                # Upload to supabase storage bucket "images"
                client.storage.from_("images").upload(
                    file=img_bytes,
                    path=filename,
                    file_options={"content-type": "image/png"}
                )
            except Exception as e:
                # File might already exist or upload failed
                print("Warning: Failed to upload image to supabase:", e)
                pass

    import copy
    to_store = copy.deepcopy(record)
    # Remove large base64 strings from the database JSON object
    to_store.get("images", {}).pop("variants_data", None)
    
    data = {
        "user_id": user_id,
        "analysis_id": analysis_id,
        "patient_name": patient_name,
        "classification": classification,
        "record": to_store
    }
    
    client.table("analyses").insert(data).execute()

def list_analyses(user_id: str, token: str) -> list:
    """Returns a list of analyses for the given user, ordered by creation."""
    client = _client_for(token)
    if not client:
        return []

    response = client.table("analyses").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    # Return the inner records
    return [item.get("record") for item in response.data]

def get_analysis(user_id: str, token: str, analysis_id: str) -> dict:
    client = _client_for(token)
    if not client:
        return None

    response = client.table("analyses").select("record").eq("user_id", user_id).eq("analysis_id", analysis_id).execute()
    if response.data and len(response.data) > 0:
        return response.data[0].get("record")
    return None

def delete_analysis(user_id: str, token: str, analysis_id: str) -> bool:
    client = _client_for(token)
    if not client:
        return False

    response = client.table("analyses").delete().eq("user_id", user_id).eq("analysis_id", analysis_id).execute()
    return len(response.data) > 0

def get_image_url(filename: str) -> str:
    """Returns the public URL for an image in the bucket."""
    if not supabase:
        return ""
    return supabase.storage.from_("images").get_public_url(filename)
