const handleClientSearch = async (searchTerm) => {
  if (searchTerm.trim() === '') {
    setFilteredClients([]);
    return;
  }

  try {
    const response = await searchClients(searchTerm, accountSlug);
    const clients = response.data || [];
    setFilteredClients(clients);
  } catch (error) {
    console.error('Error searching clients:', error);
    setFilteredClients([]);
  }
};
