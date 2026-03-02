import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import SubCourtForm from '../components/SubcourtForm'

export default function OwnerCourtDetail() {
  const { id } = useParams()

  const [court, setCourt] = useState(null)
  const [subCourts, setSubCourts] = useState([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [editingSubCourt, setEditingSubCourt] = useState(null)

  useEffect(() => {
    loadDetail()
  }, [])

  const loadDetail = async () => {
    try {
      const res = await api.get(`/courts/${id}`)
      setCourt(res.data)

      const sub = await api.get(`/courts/${id}/sub-courts`)
      setSubCourts(sub.data)
    } catch {
      alert('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const toggleSubCourtStatus = async (sc) => {
    await api.put(`/sub-courts/${sc.id}/status`, {
      status: sc.status === 'active' ? 'maintenance' : 'active'
    })
    loadDetail()
  }

  if (loading) return <div>Đang tải...</div>

  return (
    <div className="dashboardPage">
      <h1>🏟️ {court.name}</h1>
      <p>{court.address}</p>
      <p>{court.description}</p>

      <hr />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>🎯 Danh sách sân con</h3>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          ➕ Thêm sân con
        </button>
      </div>

      {subCourts.map(sc => (
        <div key={sc.id} className="glass-card">
          <b>{sc.name}</b>
          <div>
            🏟️ {sc.court_type} | 🧱 {sc.surface_type}
          </div>
          <span>
            {sc.status === 'active' ? '🟢 Hoạt động' : '🛠️ Bảo trì'}
          </span>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => toggleSubCourtStatus(sc)}
            >
              {sc.status === 'active' ? 'Bảo trì' : 'Kích hoạt'}
            </button>

            <button
              className="btn btn-outline btn-sm"
              onClick={() => setEditingSubCourt(sc)}
            >
              ✏️ Sửa
            </button>
          </div>
        </div>
      ))}

      {showCreate && (
        <SubCourtForm
          courtId={id}
          onClose={() => setShowCreate(false)}
          onSuccess={loadDetail}
        />
      )}

      {editingSubCourt && (
        <SubCourtForm
          subCourt={editingSubCourt}
          onClose={() => setEditingSubCourt(null)}
          onSuccess={loadDetail}
        />
      )}
    </div>
  )
}