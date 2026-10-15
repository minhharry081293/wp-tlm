"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, PageHeader } from "./ui";

type UserRow = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  siteCount: number;
};

export function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không tải được user");
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được user");
      setUsername("");
      setPassword("");
      setRole("user");
      setInfo(`Đã tạo ${data.user.username}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: UserRow) {
    const next = prompt(`Mật khẩu mới cho ${user.username}`);
    if (!next) return;
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không đổi được mật khẩu");
      return;
    }
    setInfo(`Đã đổi mật khẩu ${user.username}`);
  }

  async function remove(user: UserRow) {
    if (!confirm(`Xóa user ${user.username}? Site của họ sẽ không còn chủ.`)) return;
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không xóa được user");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Mỗi user chỉ thấy và đặt textlink trên site do chính họ thêm."
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">Thêm user</h3>
        <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mật khẩu"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Đang tạo…" : "Tạo"}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Vai trò</th>
              <th className="px-5 py-3 font-medium">Site</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-5 py-3.5 font-medium text-stone-900">{user.username}</td>
                <td className="px-5 py-3.5 text-stone-600">{user.role}</td>
                <td className="px-5 py-3.5 text-stone-600">{user.siteCount}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => resetPassword(user)}
                    className="mr-3 text-xs font-medium text-teal-700 hover:underline"
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(user)}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
