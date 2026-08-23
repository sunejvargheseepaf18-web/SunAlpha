import React, { useState } from 'react';
import {
  getWebhookDestinations,
  addWebhookDestination,
  deleteWebhookDestination,
  setWebhookEnabled,
  sendTestWebhook,
  getDeliveryLog,
  WebhookDestination,
  DeliveryRecord
} from '../services/webhookService';
import { Webhook, Trash2, Send, Loader2, Power } from 'lucide-react';

// Webhook automation: every triggered alert is POSTed as JSON to each
// enabled destination (Discord/Slack/automation endpoints), with retry and
// backoff handled by the pure webhook engine.

export const WebhookPanel: React.FC = () => {
  const [destinations, setDestinations] = useState<WebhookDestination[]>(getWebhookDestinations());
  const [log, setLog] = useState<DeliveryRecord[]>(getDeliveryLog());
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const refresh = () => {
    setDestinations(getWebhookDestinations());
    setLog(getDeliveryLog());
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    const result = addWebhookDestination({ name: name.trim(), url: url.trim() });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setName('');
    setUrl('');
    refresh();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    await sendTestWebhook(id);
    setTestingId(null);
    refresh();
  };

  return (
    <div className="border-t border-gray-100 pt-4 mt-6">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 flex items-center">
        <Webhook size={14} className="mr-1.5" /> Webhook Automation
        <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{destinations.length}</span>
      </h4>
      <p className="text-[10px] text-gray-400 mb-3">
        Every triggered alert is POSTed as JSON to each enabled endpoint (retries with backoff).
      </p>

      <form onSubmit={handleAdd} className="flex space-x-2 mb-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="w-24 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-orange-400"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://…/webhook"
          className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg font-mono outline-none focus:border-orange-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black"
        >
          Add
        </button>
      </form>
      {error && <p className="text-[10px] text-red-500 mb-2">{error}</p>}

      <div className="space-y-1.5">
        {destinations.map(dest => (
          <div key={dest.id} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg">
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold ${dest.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                {dest.name}
              </p>
              <p className="text-[10px] text-gray-400 font-mono truncate">{dest.url}</p>
            </div>
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={() => { setWebhookEnabled(dest.id, !dest.enabled); refresh(); }}
                className={`p-1.5 rounded ${dest.enabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-50'}`}
                title={dest.enabled ? 'Disable' : 'Enable'}
              >
                <Power size={13} />
              </button>
              <button
                onClick={() => handleTest(dest.id)}
                disabled={testingId === dest.id}
                className="p-1.5 rounded text-blue-500 hover:bg-blue-50 disabled:opacity-50"
                title="Send test payload"
              >
                {testingId === dest.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
              <button
                onClick={() => { deleteWebhookDestination(dest.id); refresh(); }}
                className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Recent deliveries</p>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {log.slice(0, 6).map(rec => (
              <div key={rec.id} className="flex justify-between text-[10px] text-gray-500">
                <span className="truncate">{rec.destinationName} · {rec.symbol}</span>
                <span className={`font-mono font-bold ml-2 ${rec.status === 'DELIVERED' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {rec.status === 'DELIVERED' ? 'OK' : `FAIL${rec.httpStatus ? ` ${rec.httpStatus}` : ''}`}
                  {rec.attempts > 1 ? ` ×${rec.attempts}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
