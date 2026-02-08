import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useEnsAvatar, useEnsName } from 'wagmi';
import { MSG_GET_ACTIVE_SESSION } from '~/utils/messages';
import type { TabSession, FeedItem } from '~/utils/types';
import { formatRelativeTime, shortAddress } from '~/utils/format';

function EnsAddress({ address, backendEns }: { address: string; backendEns?: { name: string; avatar?: string | null } }) {
  // Prefer backend-resolved ENS (already available without a new RPC call)
  const { data: wagmiName } = useEnsName({ address: address as `0x${string}`, chainId: 1 });
  const resolvedName = backendEns?.name ?? wagmiName;
  const { data: wagmiAvatar } = useEnsAvatar({ name: resolvedName ?? undefined, chainId: 1 });
  const avatar = backendEns?.avatar ?? wagmiAvatar;
  const display = resolvedName ?? shortAddress(address);
  return (
    <span className="ens-address">
      {avatar && <img src={avatar} alt="" className="ens-avatar" />}
      <span>{display}</span>
    </span>
  );
}

function RiskBadge({ flagged }: { flagged: boolean }) {
  if (!flagged) return null;
  return <span className="risk-badge risk-badge--danger" title="Address flagged by ScamSniffer">FLAGGED</span>;
}

function FeedItemRow({ item, expanded, onToggle }: { item: FeedItem; expanded: boolean; onToggle: () => void }) {
  const toAddr = item.params?.to as string | undefined;
  const hasAddress = toAddr && /^0x[a-fA-F0-9]{40}$/.test(toAddr);

  return (
    <div
      className={`feed-item feed-item--${item.severity}`}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      <div className="feed-item-header">
        <span className="feed-item-kind">{item.kind}</span>
        <span className="feed-item-oneliner">{item.oneLiner}</span>
        {item.risk?.flagged && <RiskBadge flagged={true} />}
        <span className="feed-item-phase">{item.phase}</span>
      </div>
      {expanded && (
        <div className="feed-item-detail">
          <div>Method: {item.method}</div>
          <div>Phase: {item.phase}</div>
          {item.params?.to != null && (
            <div>
              To: {hasAddress
                ? <EnsAddress address={toAddr} backendEns={item.toEns} />
                : String(item.params.to)}
            </div>
          )}
          {item.toEns?.name && (
            <div className="feed-item-ens">ENS: {item.toEns.name}</div>
          )}
          {item.risk && (
            <div className={item.risk.flagged ? 'feed-item-risk feed-item-risk--flagged' : 'feed-item-risk'}>
              Risk: {item.risk.flagged ? 'Flagged (ScamSniffer)' : 'Clean'}
              {item.risk.lastUpdated && (
                <span className="feed-item-risk-updated"> (checked {formatRelativeTime(item.risk.lastUpdated)})</span>
              )}
            </div>
          )}
          {item.params?.value != null && <div>Value: {String(item.params.value)}</div>}
          {item.params?.hasData != null && <div>Has data: {String(item.params.hasData)}</div>}
          {item.params?.chainId != null && <div>Chain ID: {String(item.params.chainId)}</div>}
          {item.error && <div className="feed-item-error">Error: {item.error}</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<TabSession | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSession = () => {
    browser.runtime.sendMessage({ type: MSG_GET_ACTIVE_SESSION }).then((s: TabSession | null) => setSession(s));
  };

  useEffect(() => {
    fetchSession();
    const listener = () => fetchSession();
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const counts = session?.counts ?? { connect: 0, sign: 0, tx: 0, chain: 0 };

  return (
    <div className="popup">
      <header className="popup-header">
        <h1 className="popup-title">ENSight</h1>
        <ConnectButton showBalance={false} />
      </header>

      <section className="popup-profile">
        <EnsProfile />
      </section>

      <section className="popup-tab">
        <div className="popup-tab-hostname">{session?.hostname ?? '—'}</div>
        <div className="popup-tab-status">
          {session?.web3Active ? 'Web3 active' : 'Inactive'}
          {session && ` · ${formatRelativeTime(session.lastSeenAt)}`}
        </div>
      </section>

      <section className="popup-counts">
        <span title="Connect">C: {counts.connect}</span>
        <span title="Sign">S: {counts.sign}</span>
        <span title="Transaction">T: {counts.tx}</span>
        <span title="Chain">Ch: {counts.chain}</span>
      </section>

      <section className="popup-feed">
        <h2>Activity feed</h2>
        {session?.feed?.length ? (
          <ul className="feed-list">
            {session.feed.map((item) => (
              <li key={item.id}>
                <FeedItemRow
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId((id) => (id === item.id ? null : item.id))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="feed-empty">No wallet activity on this tab yet.</p>
        )}
      </section>
    </div>
  );
}

function EnsProfile() {
  const { address, isConnected } = useAccount();
  const { data: name } = useEnsName({ address: address ?? undefined, chainId: 1 });
  const { data: avatar } = useEnsAvatar({ name: name ?? undefined, chainId: 1 });

  if (!isConnected || !address) return null;

  return (
    <div className="ens-profile">
      {avatar && <img src={avatar} alt="" className="ens-profile-avatar" />}
      <div className="ens-profile-text">
        <span className="ens-profile-name">{name ?? shortAddress(address)}</span>
        <span className="ens-profile-address">{shortAddress(address)}</span>
      </div>
    </div>
  );
}
