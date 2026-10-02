import api from './api';

export const getBookingReport = (params) => api.get('/reports/bookings', { params });
export const getEventReport = (params) => api.get('/reports/events', { params });
export const getReportHistory = (params) => api.get('/reports', { params });
export const getReportById = (id) => api.get(`/reports/${id}`);
