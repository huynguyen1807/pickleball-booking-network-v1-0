import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import SubCourtForm from '../components/SubCourtForm.tsx'
import { useDialog } from '../context/DialogContext'

export default function OwnerCourtDetail() {
  const { id } = useParams<{ id: string }>()
  const { showAlert, showConfirm } = useDialog()
  if (!id) return <div>Sân không hợp lệ</div>

  const [court, setCourt] = useState(null)
  const [subCourts, setSubCourts] = useState([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [editingSubCourt, setEditingSubCourt] = useState(null)
  const [editingCourt, setEditingCourt] = useState(false)
  const [courtForm, setCourtForm] = useState({
    name: '', address: '', description: ''
  })

  useEffect(() => {
    loadDetail()
  }, [])

  const loadDetail = async () => {
    try {
      const res = await api.get(`/courts/${id}`)
      setCourt(res.data)
      setCourtForm({
        name: res.data.name,
        address: res.data.address,
        description: res.data.description
      })

      const sub = await api.get(`/courts/${id}/sub-courts`)
      setSubCourts(sub.data)
    } catch {
      await showAlert('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const toggleSubCourtStatus = async (sc) => {
    try {
      await api.put(`/courts/${id}/sub-courts/${sc.id}/status`, {
        status: sc.status === 'active' ? 'maintenance' : 'active'
      })
      loadDetail()
    } catch (err) {
      await showAlert(err.response?.data?.message || 'Lỗi server khi đổi trạng thái')
    }
  }

  const deleteSubCourt = async (scId) => {
    const isConfirm = await showConfirm('Xóa sân con này?')
    if (!isConfirm) return
    try {
      await api.delete(`/courts/${id}/sub-courts/${scId}`)
      setSubCourts(prev => prev.filter(s => s.id !== scId))
    } catch (err) {
      await showAlert(err.response?.data?.message || 'Lỗi xóa sân con')
    }
  }

  const updateCourt = async () => {
    try {
      // include price and maybe other fields if they exist
      const payload = { ...courtForm }
      await api.put(`/courts/${id}`, payload)
      setCourt(prev => ({ ...prev, ...courtForm }))
      setEditingCourt(false)
      await showAlert('Cập nhập sân thành công')
    } catch (err) {
      await showAlert(err.response?.data?.message || 'Lỗi cập nhập sân')
    }
  }

  const deleteCourt = async () => {
    const isConfirm = await showConfirm('Xóa sân này? Tất cả sân con sẽ bị xóa!')
    if (!isConfirm) return
    try {
      await api.delete(`/courts/${id}`)
      await showAlert('Xóa sân thành công')
      window.location.href = '/owner-dashboard'
    } catch (err) {
      await showAlert(err.response?.data?.message || 'Lỗi xóa sân')
    }
  }

  if (loading) return <div>Đang tải...</div>

  return (
    <div className="dashboardPage" style={{ paddingTop: '80px' }}>
      {/* forms moved to sub-court section */}

      {editingCourt && (
        <div className="glass-card" style={{ margin: '20px 200px 50px 200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>✏️ Cập nhập thông tin sân</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingCourt(false)}
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
            >
              ✕ Đóng
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>Tên sân</label>
              <input
                type="text"
                className="input-field"
                value={courtForm.name}
                onChange={e => setCourtForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Địa chỉ</label>
            <input
              type="text"
              className="input-field"
              value={courtForm.address}
              onChange={e => setCourtForm(p => ({ ...p, address: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label>Mô tả</label>
            <textarea
              className="input-field"
              rows={4}
              value={courtForm.description}
              onChange={e => setCourtForm(p => ({ ...p, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingCourt(false)}>
              Hủy
            </button>
            <button className="btn btn-primary btn-sm" onClick={updateCourt}>
              💾 Lưu thay đổi
            </button>
          </div>
        </div>
      )}

      {!editingCourt && (
        <div className="glass-card" style={{ margin: '10px 500px 50px 500px' }}>
          <h3 style={{ marginBottom: '24px' }}>✏️ Thông tin cơ sở {court.name}</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
            <h2>🏟️ {court.name}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setEditingCourt(true)}>
                ✏️ Chỉnh sửa sân
              </button>

            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Địa chỉ</label>
              <p style={{ fontSize: '0.95rem', marginTop: '4px' }}>📍 {court.address}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Giá / Giờ</label>
              <p style={{ fontSize: '0.95rem', marginTop: '4px', fontWeight: 600 }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(court.price_per_hour || 0)}
              </p>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mô tả</label>
            <p style={{ fontSize: '0.95rem', marginTop: '4px', lineHeight: '1.5' }}>
              {court.description || '(Chưa có mô tả)'}
            </p>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>ℹ️ Cấu hình giá và khung giờ được thiết lập riêng cho từng sân con</span>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tổng cộng: <b>{subCourts.length}</b> sân con
            </p>
          </div>
        </div>
      )}

      <hr />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 300px 20px 300px' }}>
        <h3>🎯 Danh sách sân con ({subCourts.length})</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          ➕ Thêm sân con
        </button>
      </div>

      {/* forms for sub-courts */}
      {showCreate && (
        <SubCourtForm
          courtId={id}
          onClose={() => setShowCreate(false)}
          onSuccess={loadDetail}
        />
      )}

      {editingSubCourt && (
        <SubCourtForm
          courtId={id}
          subCourt={editingSubCourt}
          onClose={() => setEditingSubCourt(null)}
          onSuccess={loadDetail}
        />
      )}

      {subCourts && subCourts.length > 0 ? (
        subCourts.map(sc => (
          <div key={sc.id} className="glass-card" style={{ margin: '10px 500px 50px 500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>{sc.name}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  🏟️ {sc.court_type} | 🧱 {sc.surface_type}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: sc.status === 'active' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                  {sc.status === 'active' ? '🟢 Hoạt động' : '🛠️ Bảo trì'}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Giá / Giờ</label>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, fontSize: '0.95rem' }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(sc.price_per_hour || 0)}
              </p>
            </div>



            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggleSubCourtStatus(sc)}
              >
                {sc.status === 'active' ? '⏸️ Bảo trì' : '▶️ Kích hoạt'}
              </button>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEditingSubCourt(sc)}
              >
                ✏️ Sửa
              </button>

            </div>
          </div>
        ))
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
          <p>Chưa có sân con nào. Hãy thêm sân con đầu tiên!</p>
        </div>
      )}

    </div>
  )
}