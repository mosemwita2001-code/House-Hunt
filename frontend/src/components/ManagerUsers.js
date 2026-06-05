import { fetchUsers } from '../services/userService';

useEffect(() => {
  const loadData = async () => {
    try {
      const response = await fetchUsers(); // clean and readable
      setUsers(response.data);
    } catch (err) {
      console.error("Error fetching:", err);
    }
  };
  loadData();
}, []);