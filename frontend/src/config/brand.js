export const supportWhatsAppNumber = '9647760307768';
export const supportInstagramUrl = process.env.REACT_APP_SUPPORT_INSTAGRAM || '';

export const buildSupportWhatsAppUrl = (message = '') => {
  if (!supportWhatsAppNumber) return '';
  const suffix = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${supportWhatsAppNumber}${suffix}`;
};


export const createPublicPropertyUrl = (token) => {
  const backend = (process.env.REACT_APP_BACKEND_URL || window.location.origin).replace(/\/+$/, '');
  return `${backend}/share/${encodeURIComponent(token)}`;
};
