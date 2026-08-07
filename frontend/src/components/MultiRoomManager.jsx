import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Save, X } from 'lucide-react';
import API from '../services/api';
import ImageCarousel from './ImageCarousel';
import LoadingSpinner from './LoadingSpinner';

const ROOM_HOUSE_TYPES = ['Bedsitter', 'Single Room', 'One Bedroom', 'Two Bedroom', 'Three Bedroom', 'Four Bedroom', 'Penthouse', 'Studio'];
const fieldStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 11px', fontSize: 12, color: 'white', outline: 'none' };
const muted = { color: 'rgba(255,255,255,0.7)', fontSize: 12 };
const emptyTypeDraft = () => ({ house_type: '', price: '', description: '', files: [] });

const errorMessage = error => error.response?.data?.message || error.message || 'Something went wrong. Please try again.';

function RoomTypeBlock({ roomType, roomDraft, onDraftChange, onAddRoom, onEditRoomType, onRenameRoom, onStatusChange, actionLoading }) {
  const rooms = roomType.rooms || [];
  const [editingType, setEditingType] = useState(false);
  const [typeEdit, setTypeEdit] = useState({ price: roomType.price, description: roomType.description || '', files: [] });
  const [labelDrafts, setLabelDrafts] = useState({});
  const typeBusy = actionLoading === `room-type-${roomType.id}`;
  const roomAction = roomId => actionLoading === `room-status-${roomId}`;
  const renameBusy = roomId => actionLoading === `room-rename-${roomId}`;
  const labelFor = room => labelDrafts[room.id] ?? room.room_label;

  const beginTypeEdit = () => {
    setTypeEdit({ price: roomType.price, description: roomType.description || '', files: [] });
    setEditingType(true);
  };

  const saveTypeEdit = async event => {
    event.preventDefault();
    await onEditRoomType(roomType.id, typeEdit);
    setEditingType(false);
  };

  return (
    <section style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.025)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: 'white', fontSize: 15 }}>{roomType.house_type}</h3>
          {roomType.description && <p style={{ ...muted, margin: '5px 0 0' }}>{roomType.description}</p>}
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 7 }}>
          <strong style={{ color: '#c4b5fd', fontSize: 14 }}>KSh {Number(roomType.price).toLocaleString()} <span style={{ ...muted, fontWeight: 400 }}>/mo</span></strong>
          <button type="button" onClick={editingType ? () => setEditingType(false) : beginTypeEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#c4b5fd', fontSize: 11, cursor: 'pointer' }}>
            {editingType ? <X size={13} /> : <Pencil size={13} />}{editingType ? 'Cancel' : 'Edit type'}
          </button>
        </div>
      </div>

      {editingType ? <form onSubmit={saveTypeEdit} style={{ display: 'grid', gap: 8, marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
        <label style={{ ...muted, display: 'grid', gap: 5 }}>Price per month (KSh)
          <input required type="number" min="1" value={typeEdit.price} onChange={event => setTypeEdit(previous => ({ ...previous, price: event.target.value }))} style={fieldStyle} />
        </label>
        <label style={{ ...muted, display: 'grid', gap: 5 }}>Description
          <textarea rows={2} value={typeEdit.description} onChange={event => setTypeEdit(previous => ({ ...previous, description: event.target.value }))} style={{ ...fieldStyle, resize: 'vertical' }} />
        </label>
        <label style={{ ...muted, display: 'grid', gap: 5 }}>Replace representative photos (optional)
          <input type="file" accept="image/*" multiple onChange={event => setTypeEdit(previous => ({ ...previous, files: Array.from(event.target.files || []) }))} style={{ ...fieldStyle, padding: 7 }} />
        </label>
        {typeEdit.files.length > 0 && <p style={{ ...muted, margin: 0 }}>{typeEdit.files.length} new photo{typeEdit.files.length === 1 ? '' : 's'} selected</p>}
        <button type="submit" disabled={typeBusy} aria-busy={typeBusy} style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', width: 'fit-content', padding: '8px 11px', border: 0, borderRadius: 9, background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer', opacity: typeBusy ? 0.6 : 1 }}>
          {typeBusy && <LoadingSpinner size={12} />}<Save size={13} /> Save room type
        </button>
      </form> : <ImageCarousel images={roomType.images || []} alt={`${roomType.house_type} sample`} className="h-40 rounded-xl" />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, margin: '14px 0' }}>
        {rooms.length ? rooms.map(room => {
          const currentStatus = room.status || 'available';
          const nextStatus = currentStatus === 'taken' ? 'available' : 'taken';
          const busy = roomAction(room.id);
          const labelBusy = renameBusy(room.id);
          return (
            <div key={room.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', background: '#0f0f23', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <input aria-label={`Room label for ${room.room_label}`} value={labelFor(room)} onChange={event => setLabelDrafts(previous => ({ ...previous, [room.id]: event.target.value }))} style={{ ...fieldStyle, padding: '7px 8px', minWidth: 0 }} />
                <span style={{ color: currentStatus === 'available' ? '#34d399' : '#fbbf24', fontSize: 10, fontWeight: 700 }}>{currentStatus === 'available' ? 'Available' : 'Taken'}</span>
              </div>
              <button type="button" disabled={labelBusy} aria-busy={labelBusy} onClick={() => onRenameRoom(room.id, labelFor(room))} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 9, padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', fontSize: 11, cursor: labelBusy ? 'not-allowed' : 'pointer', opacity: labelBusy ? 0.6 : 1 }}>
                {labelBusy && <LoadingSpinner size={12} />} Save label
              </button>
              <button type="button" disabled={busy} aria-busy={busy} onClick={() => onStatusChange(room)} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 7, padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy && <LoadingSpinner size={12} />}{busy ? 'Updating...' : `Mark ${nextStatus}`}
              </button>
            </div>
          );
        }) : <p style={{ ...muted, margin: 0 }}>No rooms have been added yet.</p>}
      </div>

      <form onSubmit={event => { event.preventDefault(); onAddRoom(roomType.id); }} style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 13 }}>
        <p style={{ color: 'white', fontWeight: 700, fontSize: 12, margin: '0 0 8px' }}>Add rooms</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
          <label style={{ ...muted, display: 'grid', gap: 5 }}>Quantity (1–100)
            <input required type="number" min="1" max="100" value={roomDraft.quantity} onChange={event => onDraftChange(roomType.id, 'quantity', event.target.value)} style={fieldStyle} />
          </label>
          <button type="submit" disabled={actionLoading === `add-room-${roomType.id}`} aria-busy={actionLoading === `add-room-${roomType.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', padding: '9px 12px', border: 0, borderRadius: 9, background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer', opacity: actionLoading === `add-room-${roomType.id}` ? 0.6 : 1 }}>
            {actionLoading === `add-room-${roomType.id}` && <LoadingSpinner size={12} />}<Plus size={13} /> Add rooms
          </button>
        </div>
        <p style={{ ...muted, margin: '7px 0 0' }}>Labels are generated automatically. You can rename rooms above after creation.</p>
      </form>
    </section>
  );
}

export default function MultiRoomManager({ propertyId, propertyTitle, onDone, addToast, pendingPayment, onContinuePayment, paymentLoading }) {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [typeDraft, setTypeDraft] = useState(emptyTypeDraft);
  const [roomDrafts, setRoomDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/properties/${propertyId}`);
      setRoomTypes(data.room_types || []);
    } catch (error) {
      addToast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, propertyId]);

  useEffect(() => { load(); }, [load]);

  const addRoomType = async event => {
    event.preventDefault();
    if (!typeDraft.house_type || !typeDraft.price || Number(typeDraft.price) <= 0) {
      addToast('Choose a room type and enter a positive price.', 'error');
      return;
    }
    setActionLoading('room-type');
    try {
      const formData = new FormData();
      formData.append('house_type', typeDraft.house_type);
      formData.append('price', typeDraft.price);
      formData.append('description', typeDraft.description);
      typeDraft.files.forEach(file => formData.append('images', file));
      await API.post(`/properties/${propertyId}/room-types`, formData);
      setTypeDraft(emptyTypeDraft());
      await load();
      addToast('Room type added.', 'success');
    } catch (error) {
      addToast(errorMessage(error), 'error');
    } finally {
      setActionLoading('');
    }
  };

  const editRoomType = async (roomTypeId, draft) => {
    setActionLoading(`room-type-${roomTypeId}`);
    try {
      const formData = new FormData();
      formData.append('price', draft.price);
      formData.append('description', draft.description);
      draft.files.forEach(file => formData.append('images', file));
      await API.patch(`/properties/${propertyId}/room-types/${roomTypeId}`, formData);
      await load();
      addToast('Room type updated.', 'success');
    } catch (error) {
      addToast(errorMessage(error), 'error');
      throw error;
    } finally {
      setActionLoading('');
    }
  };

  const addRoom = async roomTypeId => {
    const draft = roomDrafts[roomTypeId] || { quantity: 1 };
    const quantity = Number(draft.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      addToast('Enter a quantity between 1 and 100.', 'error');
      return;
    }
    setActionLoading(`add-room-${roomTypeId}`);
    try {
      await API.post(`/room-types/${roomTypeId}/rooms`, { quantity });
      setRoomDrafts(previous => ({ ...previous, [roomTypeId]: { quantity: 1 } }));
      await load();
      addToast(`${quantity} room${quantity === 1 ? '' : 's'} added.`, 'success');
    } catch (error) {
      addToast(errorMessage(error), 'error');
    } finally {
      setActionLoading('');
    }
  };

  const updateRoomDraft = (roomTypeId, field, value) => setRoomDrafts(previous => ({
    ...previous,
    [roomTypeId]: { ...(previous[roomTypeId] || { quantity: 1 }), [field]: value },
  }));

  const renameRoom = async (roomId, label) => {
    if (!label.trim()) {
      addToast('Enter a room label first.', 'error');
      return;
    }
    setActionLoading(`room-rename-${roomId}`);
    try {
      await API.patch(`/rooms/${roomId}`, { room_label: label.trim() });
      setRoomTypes(previous => previous.map(type => ({
        ...type,
        rooms: (type.rooms || []).map(room => room.id === roomId ? { ...room, room_label: label.trim() } : room),
      })));
      addToast('Room label updated.', 'success');
    } catch (error) {
      addToast(errorMessage(error), 'error');
    } finally {
      setActionLoading('');
    }
  };

  const changeRoomStatus = async room => {
    const status = room.status === 'taken' ? 'available' : 'taken';
    setActionLoading(`room-status-${room.id}`);
    try {
      await API.patch(`/rooms/${room.id}/status`, { status });
      setRoomTypes(previous => previous.map(type => ({
        ...type,
        rooms: (type.rooms || []).map(item => item.id === room.id ? { ...item, status } : item),
      })));
      addToast(`Room marked ${status}.`, 'success');
    } catch (error) {
      addToast(errorMessage(error), 'error');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <button type="button" aria-label="Back to properties" onClick={onDone} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>←</button>
        <div><h1 style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: 0 }}>Manage Rooms</h1><p style={{ ...muted, margin: '3px 0 0' }}>{propertyTitle || 'Multi-room building'}</p></div>
      </div>

      {pendingPayment && <div style={{ marginBottom: 16, padding: 15, borderRadius: 14, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.08)' }}>
        <strong style={{ color: '#fbbf24', fontSize: 13 }}>Payment is still required to publish this building.</strong>
        <p style={{ ...muted, margin: '6px 0 10px' }}>You can finish adding rooms now; the building becomes visible after payment.</p>
        {pendingPayment.payment?.redirect_url && <button type="button" onClick={onContinuePayment} disabled={paymentLoading} aria-busy={paymentLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 9, padding: '8px 12px', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{paymentLoading && <LoadingSpinner size={12} />}{paymentLoading ? 'Opening...' : 'Complete listing payment'}</button>}
      </div>}

      <div style={{ display: 'grid', gap: 14 }}>
        <form onSubmit={addRoomType} style={{ padding: 16, borderRadius: 16, background: '#0f0f23', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Building2 size={16} color="#a78bfa" /><h2 style={{ color: 'white', fontSize: 14, margin: 0 }}>Add a room type</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ ...muted, display: 'grid', gap: 5 }}>House type
              <select required value={typeDraft.house_type} onChange={event => setTypeDraft(previous => ({ ...previous, house_type: event.target.value }))} style={fieldStyle}><option value="" style={{ color: '#111827' }}>Select type</option>{ROOM_HOUSE_TYPES.map(type => <option key={type} value={type} style={{ color: '#111827' }}>{type}</option>)}</select>
            </label>
            <label style={{ ...muted, display: 'grid', gap: 5 }}>Price per month (KSh)
              <input required type="number" min="1" value={typeDraft.price} onChange={event => setTypeDraft(previous => ({ ...previous, price: event.target.value }))} placeholder="3000" style={fieldStyle} />
            </label>
            <label style={{ ...muted, display: 'grid', gap: 5, gridColumn: '1 / -1' }}>Description (optional)
              <textarea rows={2} value={typeDraft.description} onChange={event => setTypeDraft(previous => ({ ...previous, description: event.target.value }))} placeholder="Describe this room block" style={{ ...fieldStyle, resize: 'vertical' }} />
            </label>
            <label style={{ ...muted, display: 'grid', gap: 5, gridColumn: '1 / -1' }}>Representative photos (optional)
              <input type="file" accept="image/*" multiple onChange={event => setTypeDraft(previous => ({ ...previous, files: Array.from(event.target.files || []) }))} style={{ ...fieldStyle, padding: 7 }} />
            </label>
          </div>
          {typeDraft.files.length > 0 && <p style={{ ...muted, margin: '8px 0 0' }}>{typeDraft.files.length} photo{typeDraft.files.length === 1 ? '' : 's'} selected</p>}
          <button type="submit" disabled={actionLoading === 'room-type'} aria-busy={actionLoading === 'room-type'} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, border: 0, borderRadius: 9, padding: '9px 13px', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer', opacity: actionLoading === 'room-type' ? 0.6 : 1 }}>{actionLoading === 'room-type' ? <LoadingSpinner size={12} /> : <Save size={13} />} Add room type</button>
        </form>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 35 }}><LoadingSpinner size={22} /></div> : roomTypes.length ? roomTypes.map(roomType => <RoomTypeBlock key={roomType.id} roomType={roomType} roomDraft={roomDrafts[roomType.id] || { quantity: 1 }} onDraftChange={updateRoomDraft} onAddRoom={addRoom} onEditRoomType={editRoomType} onRenameRoom={renameRoom} onStatusChange={changeRoomStatus} actionLoading={actionLoading} />) : <div style={{ padding: 24, borderRadius: 16, border: '1px dashed rgba(255,255,255,0.14)', textAlign: 'center' }}><p style={{ ...muted, margin: 0 }}>No room types yet. Add the first block above.</p></div>}
      </div>
    </div>
  );
}
