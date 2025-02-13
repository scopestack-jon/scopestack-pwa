export const getConfig = () => {
  return {
    apiUrl: process.env.REACT_APP_API_URL,
    accountSlug: process.env.REACT_APP_ACCOUNT_SLUG,
    apiToken: process.env.REACT_APP_API_TOKEN,
  };
}; 