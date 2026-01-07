import { useState, useEffect } from 'react';
import { Plus, X, Check, Search, Edit2, Trash2 } from 'lucide-react';
import useAuthStore, { User as UserType } from '../store/authStore';
import useHeaderStore from '../store/headerStore';
import { toast } from 'react-hot-toast';
import { submitToGoogleSheets, fetchUsersFromGoogleSheets } from '../utils/googleSheetsService';

const Settings = () => {
    const { setTitle } = useHeaderStore();
    const { users, addUser, updateUser, deleteUser, currentUser, setUsers } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setTitle('Settings');

        // Fetch users from Google Sheets
        const loadUsers = async () => {
            setIsLoading(true);
            try {
                const fetchedUsers = await fetchUsersFromGoogleSheets();
                if (fetchedUsers && fetchedUsers.length > 0) {
                    // Filter out users marked as "Deleted" in Column F (index 5)
                    const activeUsers = fetchedUsers.filter(user => {
                        // Assuming the user object has a 'deleted' property or we check Column F
                        // Based on your Google Sheets structure: [Name, Username, Password, Role, Pages, Deleted]
                        // Column F (index 5) contains deletion status
                        const isDeleted = user.deleted === 'Deleted' ||
                            (Array.isArray(user.rawData) && user.rawData[5] === 'Deleted');
                        return !isDeleted;
                    });
                    setUsers(activeUsers);
                }
            } catch (error) {
                console.error("Failed to load users", error);
                toast.error("Failed to load users from sheet");
            } finally {
                setIsLoading(false);
            }
        };
        loadUsers();
    }, [setTitle, setUsers]);

    // const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile'); // Removed
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserType | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<UserType>>({
        name: '',
        id: '',
        password: '',
        role: 'user',
        permissions: []
    });

    const availablePermissions = ['Dashboard', 'Resource Manager', 'Loan', 'Settings'];

    const openAddUserModal = () => {
        setEditingUser(null);
        setFormData({
            name: '',
            id: '',
            password: '',
            role: 'user',
            permissions: ['Dashboard'] // Default permission
        });
        setIsModalOpen(true);
    };

    const openEditUserModal = (user: UserType) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            id: user.id,
            password: user.password,
            role: user.role,
            permissions: user.permissions
        });
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (perm: string) => {
        setFormData(prev => {
            const currentPermissions = prev.permissions || [];
            if (currentPermissions.includes(perm)) {
                return { ...prev, permissions: currentPermissions.filter(p => p !== perm) };
            } else {
                return { ...prev, permissions: [...currentPermissions, perm] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.id || !formData.password) {
            toast.error('Username and password are required');
            return;
        }

        if (editingUser) {
            // Update existing user
            updateUser(editingUser.id, formData);

            try {
                toast.loading("Updating user in sheet...", { id: "update-user" });
                await submitToGoogleSheets({
                    action: 'updateCellsBySn',
                    sheetName: 'Pass',
                    sn: editingUser.id,
                    cellUpdates: JSON.stringify([
                        { column: 3, value: formData.password }, // Column C: Password
                        { column: 4, value: formData.role },     // Column D: Role
                        { column: 5, value: (formData.permissions || []).join(', ') } // Column E: Permissions
                    ])
                });
                toast.success('User updated locally and in sheet', { id: "update-user" });
            } catch (error) {
                console.error("Failed to update sheet", error);
                toast.error('User updated locally but failed to save to sheet', { id: "update-user" });
            }
        } else {
            // Add new user
            const success = addUser(formData as UserType);
            if (success) {
                try {
                    toast.loading("Saving user to sheet...", { id: "save-user" });
                    await submitToGoogleSheets({
                        action: 'insert',
                        sheetName: 'Pass',
                        data: [
                            formData.name, // A: Name
                            formData.id, // B: username
                            formData.password, // C: Password
                            formData.role, // D: Role
                            (formData.permissions || []).join(', '), // E: Pages
                            '' // F: Deploy Link
                        ]
                    });
                    toast.success('User added and saved to sheet', { id: "save-user" });
                } catch (error) {
                    console.error("Failed to save to sheet", error);
                    toast.error('User added locally but failed to save to sheet', { id: "save-user" });
                }
            } else {
                toast.error('User already exists');
                return;
            }
        }
        setIsModalOpen(false);
    };

    const handleDeleteUser = async (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                toast.loading("Deleting user...", { id: "delete-user" });

                // First, delete from local state
                deleteUser(id);

                // Then, mark as deleted in Google Sheets (Column F = index 6)
                await submitToGoogleSheets({
                    action: 'updateCellsBySn',
                    sheetName: 'Pass',
                    sn: id, // Use username/ID as Serial No
                    cellUpdates: JSON.stringify([
                        { column: 6, value: 'Deleted' } // Column F is index 6
                    ])
                });

                toast.success('User marked as deleted', { id: "delete-user" });
            } catch (error) {
                console.error("Failed to mark user as deleted in sheet", error);
                toast.error('User deleted locally but failed to update sheet', { id: "delete-user" });
            }
        }
    };



    return (
        <div className="p-6 md:p-8 space-y-8 h-full bg-white">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage team members and permissions</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Search - Integrated into header actions */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Find a user..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all text-sm"
                        />
                    </div>

                    <button
                        onClick={openAddUserModal}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add User
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-fade-in">
                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr className="text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 w-1/2">Access Permissions</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.map((user: UserType) => (
                                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm
                                                    ${user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                    {user.id.charAt(0).toUpperCase()}
                                                </div>
                                                <p className="font-semibold text-sm text-gray-900">{user.id}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider
                                                ${user.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {user.permissions?.slice(0, 4).map((perm: string) => (
                                                    <span key={perm} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                                                        {perm}
                                                    </span>
                                                ))}
                                                {(user.permissions?.length || 0) > 4 && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100">
                                                        +{(user.permissions?.length || 0) - 4}
                                                    </span>
                                                )}
                                                {(!user.permissions || user.permissions.length === 0) && (
                                                    <span className="text-xs text-gray-400 italic">No specific permissions</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => openEditUserModal(user)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                                    title="Edit User"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.id !== currentUser?.id && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {users.map((user: UserType) => (
                            <div key={user.id} className="p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-100">
                                            {user.id.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-base">{user.id}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Permissions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {user.permissions?.map((perm: string) => (
                                            <span key={perm} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                                {perm}
                                            </span>
                                        ))}
                                        {(user.permissions?.length || 0) === 0 && (
                                            <span className="text-xs text-gray-400 italic">No permissions assigned</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2 border-t border-gray-50">
                                    <button
                                        onClick={() => openEditUserModal(user)}
                                        className="flex-1 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-bold"
                                    >
                                        Edit User
                                    </button>
                                    {user.id !== currentUser?.id && (
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="flex-1 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-bold"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* User Logic Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 transition-all">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingUser ? 'Edit User Details' : 'Create New User'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Name</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={!!editingUser}
                                            className={`w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${editingUser ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white font-medium'}`}
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Username</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={!!editingUser}
                                            className={`w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${editingUser ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white font-medium'}`}
                                            value={formData.id}
                                            onChange={e => setFormData({ ...formData, id: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Role</label>
                                        <select
                                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Password</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Page Permissions</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {availablePermissions.map(perm => (
                                            <label key={perm} className={`
                                        flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all
                                        ${(formData.permissions || []).includes(perm)
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                    : 'border-gray-100 hover:bg-gray-50'}
                                    `}>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${(formData.permissions || []).includes(perm)
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'border-gray-300 bg-white'
                                                    }`}>
                                                    {(formData.permissions || []).includes(perm) && <Check size={14} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={(formData.permissions || []).includes(perm)}
                                                    onChange={() => handlePermissionToggle(perm)}
                                                />
                                                <span className={`text-sm font-medium ${(formData.permissions || []).includes(perm) ? 'text-indigo-900' : 'text-gray-600'}`}>
                                                    {perm}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02]"
                                >
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
