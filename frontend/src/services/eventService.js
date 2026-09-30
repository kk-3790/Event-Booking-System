import api from './api';

export const getAllEvents = () => api.get('/events');
export const getOngoingEvents = () => api.get('/events/ongoing');
export const getEventById = (id) => api.get(`/events/${id}`);
export const searchEvents = (params) => api.get('/events/search', { params });
export const createEvent = (data) => api.post('/events', data);
export const updateEvent = (id, data) => api.put(`/events/${id}`, data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const uploadBanner = (formData) =>
  api.post('/events/upload-banner', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
