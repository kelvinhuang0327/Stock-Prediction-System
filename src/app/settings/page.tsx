
"use client";

import React, { useEffect, useState } from 'react';
import { Server, Activity, Database, Bell, RefreshCw, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';

export default function SettingsPage() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [notifying, setNotifying] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/system/status');
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setMessage(null);
        try {
            const res = await fetch('/api/sync/run', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Synchronization Complete!' });
                fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Sync Failed' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Sync Error' });
        } finally {
            setSyncing(false);
        }
    };

    const handleTestNotify = async () => {
        setNotifying(true);
        setMessage(null);
        try {
            const res = await fetch('/api/system/test-notify', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Notification Sent!' });
            } else {
                setMessage({ type: 'error', text: data.message || 'Notification Failed' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Network Error' });
        } finally {
            setNotifying(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-slate-100 rounded-xl">
                    <Server className="w-8 h-8 text-slate-700" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">System Admin</h1>
                    <p className="text-slate-500">Manage engine health, data pipelines, and alerts.</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Health Card */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        System Health
                    </h3>

                    {loading ? (
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm text-slate-600 flex items-center gap-2"><Database className="w-4 h-4" /> Stocks Indexed</span>
                                <span className="font-bold text-slate-900">{status?.counts?.stocks?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm text-slate-600 flex items-center gap-2"><Activity className="w-4 h-4" /> Daily Quotes</span>
                                <span className="font-bold text-slate-900">{status?.counts?.quotes?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm text-slate-600 flex items-center gap-2"><HardDrive className="w-4 h-4" /> DB Size (Est.)</span>
                                <span className="font-bold text-slate-900">{status?.dbSize}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Operations Card */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Server className="w-5 h-5 text-purple-500" />
                        Operations Center
                    </h3>

                    <div className="space-y-4">
                        <div className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" /> Manual Sync
                                </div>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                                >
                                    {syncing ? 'Syncing...' : 'Run Sync Now'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">Fetches latest Daily Quotes, Revenue, and Indices from TWSE. (~10-30s)</p>
                        </div>

                        <div className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    <Bell className="w-4 h-4" /> Notification Test
                                </div>
                                <div className="flex gap-2">
                                    <a href="/settings/notifications"
                                        className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-600 transition-all">
                                        管理通知
                                    </a>
                                    <a href="/settings/system"
                                        className="bg-slate-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-600 transition-all">
                                        系統健康
                                    </a>
                                    <button
                                        onClick={handleTestNotify}
                                        disabled={notifying}
                                        className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
                                    >
                                        {notifying ? 'Sending...' : 'Test Alert'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">Sends a test message to your configured LINE Notify group. For full notification management, use the 管理通知 page.</p>
                        </div>

                        <div className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-red-500" /> Monitor Run
                                </div>
                                <button
                                    onClick={async () => {
                                        setMessage(null);
                                        try {
                                            const res = await fetch('/api/monitor/run');
                                            const data = await res.json();
                                            if (res.ok) {
                                                setMessage({ type: 'success', text: `Checked ${data.checked} alerts. Triggered: ${data.triggered}` });
                                            } else {
                                                setMessage({ type: 'error', text: 'Monitor Failed' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Monitor Error' });
                                        }
                                    }}
                                    className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition-all"
                                >
                                    Check Prices
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">Manually trigger the Smart Alert System to scan for price targets.</p>
                        </div>
                    </div>
                </div>
            </div>


            {/* Data Resilience Card */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Data Resilience
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="font-bold text-slate-800 mb-2">Backup Data</div>
                        <p className="text-xs text-slate-500 mb-4">Export your Watchlist and Alerts to a JSON file.</p>
                        <a
                            href="/api/system/backup"
                            target="_blank"
                            className="inline-flex items-center justify-center w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all"
                        >
                            Download Backup
                        </a>
                    </div>

                    <div className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="font-bold text-slate-800 mb-2">Restore Data</div>
                        <p className="text-xs text-slate-500 mb-4">Restore from a previous backup file.</p>
                        <label className="inline-flex items-center justify-center w-full bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-all cursor-pointer">
                            <span>Upload Backup File</span>
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (!confirm('WARNING: This will overwrite your current Watchlist and Alerts. Continue?')) {
                                        e.target.value = '';
                                        return;
                                    }

                                    const reader = new FileReader();
                                    reader.onload = async (ev) => {
                                        try {
                                            const json = JSON.parse(ev.target?.result as string);
                                            const res = await fetch('/api/system/restore', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(json)
                                            });
                                            if (res.ok) {
                                                setMessage({ type: 'success', text: 'Restore Successful!' });
                                                setTimeout(() => window.location.reload(), 1500);
                                            } else {
                                                setMessage({ type: 'error', text: 'Restore Failed' });
                                            }
                                        } catch (err) {
                                            setMessage({ type: 'error', text: 'Invalid File' });
                                        }
                                    };
                                    reader.readAsText(file);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-lg mb-4">Recent System Logs</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="p-3 rounded-l-lg">Time</th>
                                <th className="p-3">Event</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right rounded-r-lg">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {status?.lastSyncLogs?.map((log: any) => (
                                <tr key={log.id}>
                                    <td className="p-3 font-mono text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-3 font-bold text-slate-800">{log.endpoint}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {log.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-600">{log.duration}ms</td>
                                </tr>
                            ))}
                            {!loading && (!status?.lastSyncLogs || status.lastSyncLogs.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">No logs available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
