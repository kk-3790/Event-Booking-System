import api from './api';

export const getStats = () => api.get('/admin/stats');
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUserById = (id) => api.get(`/admin/users/${id}`);
export const getBookings = (params) => api.get('/admin/bookings', { params });
export const getEvents = (params) => api.get('/admin/events', { params });
export const getBookingReport = (params) => api.get('/reports/bookings', { params });
export const getEventReport = (params) => api.get('/reports/events', { params });
export const getReportHistory = () => api.get('/reports');
