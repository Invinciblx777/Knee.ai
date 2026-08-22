"""End-to-end test suite for the Knee Analysis Platform API."""

import io
import json
import os
import time
import urllib.request
import urllib.error

import cv2
import numpy as np

BASE = "http://127.0.0.1:8000/api"
SP = os.path.dirname(os.path.abspath(__file__))

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print("{} {}{}".format("PASS" if cond else "FAIL", name, "  -- " + detail if detail else ""))


def post_multipart(url, fields, file_field=None):
    boundary = "----knee%d" % time.time_ns()
    body = b""
    for k, v in fields.items():
        body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, k, v)).encode()
    if file_field:
        name, filename, data = file_field
        body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\n"
                 "Content-Type: application/octet-stream\r\n\r\n" % (boundary, name, filename)).encode()
        body += data + b"\r\n"
    body += ("--%s--\r\n" % boundary).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "multipart/form-data; boundary=%s" % boundary)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def get(path, raw=False):
    try:
        with urllib.request.urlopen(BASE + path) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data))
    except urllib.error.HTTPError as e:
        return e.code, (b"" if raw else json.loads(e.read() or b"{}"))


def delete(path):
    req = urllib.request.Request(BASE + path, method="DELETE")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}


def make_knee(seed, h=900, w=700):
    rs = np.random.RandomState(seed)
    img = np.full((h, w), 18, np.uint8)
    cv2.ellipse(img, (w // 2, int(h * .33)), (int(w * .27), int(h * .27)), 0, 0, 360, 190, -1)
    cv2.ellipse(img, (w // 2, int(h * .71)), (int(w * .28), int(h * .26)), 0, 0, 360, 180, -1)
    img = cv2.GaussianBlur(img, (7, 7), 0)
    img = np.clip(img.astype(np.int16) + (rs.randn(h, w) * 6).astype(np.int16), 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    return buf.tobytes()


def analyze(img_bytes, name, age, sex, imaging="X-ray", side="Left", filename="knee.png"):
    return post_multipart(
        BASE + "/analyze",
        {"name": name, "age": str(age), "sex": sex, "imaging_type": imaging, "affected_side": side},
        ("file", filename, img_bytes),
    )


print("=" * 68)
print("1. HEALTH + CATALOGUE")
print("=" * 68)
s, h = get("/health")
check("health 200 + ok", s == 200 and h["status"] == "ok")
s, db = get("/implants")
check("catalogue: 6 systems", s == 200 and len(db["systems"]) == 6, "got %d" % len(db["systems"]))
check("every system has XS..XL",
      all([sz["size"] for sz in sy["sizes"]] == ["XS", "S", "M", "L", "XL"] for sy in db["systems"]))
check("manufacturers cover the 3 required",
      {"Zimmer Biomet", "Stryker", "DePuy Synthes"} <= {sy["manufacturer"] for sy in db["systems"]})

print()
print("=" * 68)
print("2. ANALYSIS CONTRACT + SPEED")
print("=" * 68)
img_a = make_knee(1)
t0 = time.time()
s, r = analyze(img_a, "Test Patient A", 67, "Female")
elapsed = time.time() - t0
check("analyze 200", s == 200, str(r)[:120])
check("under 5 s (spec)", elapsed < 5.0, "%.3f s" % elapsed)
check("3 meniscus locations",
      [m["location"] for m in r["meniscus"]["measurements"]] == ["anterior_horn", "mid_body", "posterior_horn"])
check("thickness in 2.5-6.5 mm",
      all(2.5 <= m["thickness_mm"] <= 6.5 for m in r["meniscus"]["measurements"]),
      str([m["thickness_mm"] for m in r["meniscus"]["measurements"]]))
check("KL grade in 0..4", 0 <= r["meniscus"]["kl_grade"]["grade"] <= 4)
check("classification is a valid label",
      r["meniscus"]["assessment"]["classification"] in ["Normal", "Mild OA", "Moderate OA", "Severe OA"])
check("population comparison has male + female means",
      all("population_male" in c and "population_female" in c for c in r["meniscus"]["population_comparison"]))
b = r["bone_measurements"]
check("bone dims present",
      all(k in b for k in ["femoral_ml_mm", "femoral_ap_mm", "tibial_ml_mm", "tibial_ap_mm", "tibial_slope_deg"]))
check("1 primary + 2 alternatives", len(r["implant"]["alternatives"]) == 2)
check("alternatives are distinct systems",
      len({c["system_id"] for c in [r["implant"]["primary"]] + r["implant"]["alternatives"]}) == 3)
check("confidence ordered primary >= alts",
      all(r["implant"]["primary"]["confidence_pct"] >= a["confidence_pct"] for a in r["implant"]["alternatives"]))
check("8 overlay variants pre-rendered", len(r["images"]["variants"]) == 8, str(len(r["images"]["variants"])))
aid_a = r["analysis_id"]

print()
print("=" * 68)
print("3. DETERMINISM (same image -> same numbers)")
print("=" * 68)
s, r2 = analyze(img_a, "Test Patient A", 67, "Female")
same_men = [m["thickness_mm"] for m in r["meniscus"]["measurements"]] == \
           [m["thickness_mm"] for m in r2["meniscus"]["measurements"]]
same_bone = r["bone_measurements"] == r2["bone_measurements"]
same_imp = r["implant"]["primary"]["size"] == r2["implant"]["primary"]["size"] and \
           r["implant"]["primary"]["system_id"] == r2["implant"]["primary"]["system_id"]
check("meniscus identical", same_men)
check("bone dims identical", same_bone)
check("implant pick identical", same_imp)
check("hash identical", r["image_hash"] == r2["image_hash"])
img_b = make_knee(99)
s, r3 = analyze(img_b, "Test Patient A", 67, "Female")
check("different image -> different hash", r3["image_hash"] != r["image_hash"])
check("different image -> different numbers", r3["bone_measurements"] != r["bone_measurements"])

print()
print("=" * 68)
print("4. CLASSIFICATION RULES")
print("=" * 68)
s, young = analyze(img_a, "Young", 45, "Female")
s, old = analyze(img_a, "Old", 75, "Female")
order = ["Normal", "Mild OA", "Moderate OA", "Severe OA"]
yc = young["meniscus"]["assessment"]["classification"]
oc = old["meniscus"]["assessment"]["classification"]
check("age > 60 flags escalation", old["meniscus"]["assessment"]["age_escalated"] is True)
check("age <= 60 does not escalate", young["meniscus"]["assessment"]["age_escalated"] is False)
check("older patient not milder than younger", order.index(oc) >= order.index(yc), "%s vs %s" % (yc, oc))
s, male = analyze(img_a, "Male Pt", 50, "Male")
s, female = analyze(img_a, "Female Pt", 50, "Female")
mt = male["meniscus"]["assessment"]["thresholds_mm"]
ft = female["meniscus"]["assessment"]["thresholds_mm"]
check("female thresholds shifted -0.3 mm",
      all(abs(ft[k] - (mt[k] - 0.3)) < 1e-6 for k in mt), "M %s / F %s" % (mt, ft))

print()
print("=" * 68)
print("5. IMPLANT MATCHING MATH")
print("=" * 68)
p = r["implant"]["patient_dimensions_mm"]
prim = r["implant"]["primary"]
manual = sum((p[k] - prim["dimensions"][k]) ** 2 for k in p) ** 0.5
check("reported distance matches recomputed euclidean",
      abs(manual - prim["distance_mm"]) < 0.05, "%.3f vs %.3f" % (manual, prim["distance_mm"]))
s, cat = get("/implants")
best = min(
    (sum((p[k] - sz[k]) ** 2 for k in p) ** 0.5, sy["id"], sz["size"])
    for sy in cat["systems"] for sz in sy["sizes"]
)
check("primary is the global nearest size",
      (prim["system_id"], prim["size"]) == (best[1], best[2]),
      "picked %s/%s, nearest %s/%s" % (prim["system_id"], prim["size"], best[1], best[2]))
check("confidence in 5..99.5", 5.0 <= prim["confidence_pct"] <= 99.5)

print()
print("=" * 68)
print("6. VALIDATION / ERROR HANDLING")
print("=" * 68)
s, e = post_multipart(BASE + "/analyze",
                      {"name": "X", "age": "50", "sex": "Female", "imaging_type": "X-ray", "affected_side": "Left"},
                      ("file", "notes.txt", b"hello"))
check("rejects unsupported extension (400)", s == 400, "got %d" % s)
s, e = analyze(img_a, "X", 500, "Female")
check("rejects age out of range (400)", s == 400, "got %d" % s)
s, e = analyze(img_a, "X", 50, "Other")
check("rejects invalid sex (400)", s == 400, "got %d" % s)
s, e = post_multipart(BASE + "/analyze",
                      {"name": "X", "age": "50", "sex": "Female", "imaging_type": "X-ray", "affected_side": "Left"},
                      ("file", "empty.png", b""))
check("rejects empty file (400)", s == 400, "got %d" % s)
s, e = analyze(b"this is not an image at all", "X", 50, "Female")
check("rejects undecodable image (400)", s == 400, "got %d" % s)
s, e = get("/analyses/doesnotexist")
check("unknown analysis -> 404", s == 404, "got %d" % s)
s, e = get("/images/../../etc/passwd", raw=True)
check("path traversal blocked", s in (400, 404), "got %d" % s)

print()
print("=" * 68)
print("7. IMAGES, HISTORY, REPORT")
print("=" * 68)
for key in ["none", "femur", "meniscus", "tibia", "femur-meniscus-tibia"]:
    s, data = get("/images/" + r["images"]["variants"][key], raw=True)
    check("variant '%s' serves a PNG" % key, s == 200 and data[:8] == b"\x89PNG\r\n\x1a\n")
s, hist = get("/analyses")
check("history lists every stored analysis", hist["count"] == 7, "count=%d" % hist["count"])
check("history rows carry a thumbnail", all("thumbnail" in i for i in hist["items"]))
t0 = time.time()
s, pdf = get("/report/%s" % aid_a, raw=True)
pdf_t = time.time() - t0
check("report 200 + PDF magic", s == 200 and pdf[:5] == b"%PDF-")
check("report has 2 pages", pdf.count(b"/Type /Page") >= 2 or pdf.count(b"/Type/Page") >= 2)
check("report embeds 2 images", pdf.count(b"/Subtype /Image") + pdf.count(b"/Subtype/Image") == 2)
check("report built under 3 s", pdf_t < 3.0, "%.2f s" % pdf_t)
s, d = delete("/analyses/%s" % aid_a)
check("delete 200", s == 200)
s, _ = get("/analyses/%s" % aid_a)
check("deleted analysis is gone (404)", s == 404)

print()
print("=" * 68)
print("8. OVERLAY PLACEMENT (ROI detection + side selection)")
print("=" * 68)


def synth_leg(canvas, cx, h):
    cv2.rectangle(canvas, (cx - 38, int(h * .05)), (cx + 38, int(h * .40)), 200, -1)
    cv2.ellipse(canvas, (cx - 30, int(h * .44)), (38, 42), 0, 0, 360, 225, -1)
    cv2.ellipse(canvas, (cx + 30, int(h * .44)), (38, 42), 0, 0, 360, 225, -1)
    cv2.rectangle(canvas, (cx - 62, int(h * .52)), (cx + 62, int(h * .57)), 210, -1)
    cv2.rectangle(canvas, (cx - 34, int(h * .57)), (cx + 34, int(h * .95)), 200, -1)


def bilateral_png(h=760, w=1180):
    img = np.full((h, w), 14, np.uint8)
    synth_leg(img, int(w * .28), h)
    synth_leg(img, int(w * .72), h)
    img = cv2.GaussianBlur(img, (7, 7), 0)
    ok, buf = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    return buf.tobytes()


bil = bilateral_png()
s, left = analyze(bil, "Bilat L", 55, "Male", side="Left")
s, right = analyze(bil, "Bilat R", 55, "Male", side="Right")
roi_l, roi_r = left["images"]["roi"], right["images"]["roi"]
check("ROI detected on a bilateral film", roi_l["detected"] and roi_r["detected"])
check("ROI is one limb, not the whole frame",
      roi_l["w"] < 0.5 * left["images"]["width"], "roi w=%d of %d" % (roi_l["w"], left["images"]["width"]))
check("left knee maps to the viewer's right limb (AP convention)",
      roi_l["x"] > roi_r["x"], "L x=%d, R x=%d" % (roi_l["x"], roi_r["x"]))
s, blank = analyze(make_knee(5, h=600, w=600), "Fallback", 55, "Male")
check("ROI never returns an empty box",
      blank["images"]["roi"]["w"] > 0 and blank["images"]["roi"]["h"] > 0)
for aid in [left["analysis_id"], right["analysis_id"], blank["analysis_id"]]:
    delete("/analyses/%s" % aid)

print()
print("=" * 68)
print("9. HYBRID INFERENCE (sample dataset vs live upload)")
print("=" * 68)

s, cards = get("/samples")
check("sample picker lists 5 samples", s == 200 and cards["count"] == 5, "count=%d" % cards["count"])
check("samples span KL 0-4",
      sorted(c["kl_grade"] for c in cards["items"]) == [0, 1, 2, 3, 4])
check("samples mix both sexes and both sides",
      len({c["patient"]["sex"] for c in cards["items"]}) == 2
      and len({c["patient"]["side"] for c in cards["items"]}) == 2)
check("sample ages inside 45-72",
      all(45 <= c["patient"]["age"] <= 72 for c in cards["items"]))
s, thumb = get("/samples/OAI_sample_01/image", raw=True)
check("sample thumbnail serves a PNG", s == 200 and thumb[:8] == b"\x89PNG\r\n\x1a\n")

s, picked = post_multipart(BASE + "/analyze/sample/OAI_sample_03", {"name": "Picker Case"})
check("picker runs the model path", s == 200 and picked["mode"] == "model_inference", str(picked)[:80])
check("picker carries no demo banner", picked["demo_banner"] is None)
check("picker uses the sidecar demographics",
      picked["patient"]["age"] == 58 and picked["patient"]["sex"] == "Female")
check("model values come from the sidecar",
      [m["thickness_mm"] for m in picked["meniscus"]["measurements"]] == [3.6, 3.2, 3.9]
      and picked["meniscus"]["kl_grade"]["grade"] == 2)
s, _ = post_multipart(BASE + "/analyze/sample/NOPE", {})
check("unknown sample -> 404", s == 404, "got %d" % s)

sample_bytes = open(os.path.join("backend", "data", "samples", "OAI_sample_05.png"), "rb").read()
s, uploaded = analyze(sample_bytes, "Uploaded Sample", 30, "Male", imaging="MRI", side="Right")
check("uploaded sample detected by MD5", uploaded["mode"] == "model_inference")
check("sidecar demographics override the typed form",
      uploaded["patient"]["age"] == 72 and uploaded["patient"]["affected_side"] == "Left")
check("model path reports KL 4 for the post-TKA case", uploaded["meniscus"]["kl_grade"]["grade"] == 4)
s, again = analyze(sample_bytes, "Again", 30, "Male")
check("model path is reproducible",
      again["meniscus"]["measurements"] == uploaded["meniscus"]["measurements"])

s, live = analyze(make_knee(77), "Live Upload", 61, "Female")
check("unknown image falls back to demo mode", live["mode"] == "demo")
check("demo banner text is present and explicit",
      bool(live["demo_banner"]) and "Demo Mode" in live["demo_banner"]
      and "illustrative only" in live["demo_banner"])
check("history rows carry the mode", all("mode" in i for i in get("/analyses")[1]["items"]))

for aid, mode in [(picked["analysis_id"], "model"), (live["analysis_id"], "demo")]:
    s, pdf = get("/report/%s" % aid, raw=True)
    check("PDF builds in %s mode" % mode, s == 200 and pdf[:5] == b"%PDF-")

for aid in [picked["analysis_id"], uploaded["analysis_id"], again["analysis_id"], live["analysis_id"]]:
    delete("/analyses/%s" % aid)

print()
print("=" * 68)
print("FINAL: %d passed, %d failed" % (len(PASS), len(FAIL)))
if FAIL:
    for f in FAIL:
        print("  FAILED: " + f)
print("=" * 68)
