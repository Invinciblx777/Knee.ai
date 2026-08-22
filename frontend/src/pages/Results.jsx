import { Navigate, useLocation, useParams } from 'react-router-dom'

/**
 * The combined results view was split into two module pages. Existing links —
 * from History, and the redirect after a new analysis — still point here, so
 * this forwards to the OA module and carries the record through in router
 * state to avoid a refetch.
 */
export default function Results() {
  const { id } = useParams()
  const { state } = useLocation()
  return <Navigate to={`/oa/${id}`} state={state} replace />
}
