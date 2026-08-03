export const viewAccessStorageKey = (userId, propertyId) => `view_access_token_${userId || 'guest'}_${propertyId}`;

export const viewAccessHeaders = token => token ? { 'X-View-Access-Token': token } : {};
