import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string; // username
  password?: string; // in a real app, hash this!
  role: 'admin' | 'user';
  permissions: string[]; // e.g., ['Dashboard', 'Document', 'Loan']
  deleted?: string;
  rawData?: any[];
  name?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  users: User[]; // List of all users
  login: (username: string, password: string) => boolean;
  logout: () => void;
  setAuthenticatedUser: (user: User) => void;
  addUser: (user: User) => boolean;
  updateUser: (id: string, updatedUser: Partial<User>) => void;
  deleteUser: (id: string) => void;
  setUsers: (users: User[]) => void;
}

// const DEFAULT_USERS: User[] = [
//   {
//     id: 'admin',
//     password: 'admin123',
//     role: 'admin',
//     permissions: ['Dashboard', 'Document', 'Subscription', 'Loan', 'Calendar', 'Master', 'Settings']
//   },
//   {
//     id: 'user',
//     password: 'user123',
//     role: 'user',
//     permissions: ['Dashboard', 'Document', 'Calendar']
//   }
// ];

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      users: [],

      login: (username: string, password: string) => {
        const { users } = get();
        const foundUser = users.find(u => u.id === username && u.password === password);

        if (foundUser) {
          if (foundUser.deleted === 'Deleted') {
            return false;
          }
          set({ isAuthenticated: true, currentUser: foundUser });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ isAuthenticated: false, currentUser: null });
      },

      setAuthenticatedUser: (user: User) => {
        set({ isAuthenticated: true, currentUser: user });
      },

      addUser: (newUser: User) => {
        const { users } = get();
        if (users.some(u => u.id === newUser.id)) {
          return false; // User already exists
        }
        set({ users: [...users, newUser] });
        return true;
      },

      updateUser: (id: string, updatedUser: Partial<User>) => {
        set((state) => ({
          users: state.users.map(u => u.id === id ? { ...u, ...updatedUser } : u),
          // If updating the currently logged in user, update that too
          currentUser: state.currentUser?.id === id ? { ...state.currentUser, ...updatedUser } : state.currentUser
        }));
      },

      deleteUser: (id: string) => {
        set((state) => ({
          users: state.users.filter(u => u.id !== id)
        }));
      },

      setUsers: (users: User[]) => {
        set({ users });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        users: state.users,
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser
      }),
    }
  )
);

export default useAuthStore;