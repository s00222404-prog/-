import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  MessageCircle,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';

function contactId(contact) {
  return String(contact?.user_id ?? contact?.id ?? '');
}

export default function ChatWorkspace({
  chats = [],
  activeChat,
  messages = [],
  user,
  draft,
  setDraft,
  saving,
  onOpenChat,
  onSendMessage,
  onBack,
  t,
}) {
  const [query, setQuery] = useState('');
  const currentId = contactId(activeChat);

  const contacts = useMemo(() => {
    const unique = new Map();
    [...(activeChat ? [activeChat] : []), ...chats].forEach((contact) => {
      const id = contactId(contact);
      if (id && !unique.has(id)) unique.set(id, contact);
    });
    return [...unique.values()].filter((contact) => {
      const text = [contact.first_name, contact.name, contact.last_message]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return text.includes(query.trim().toLocaleLowerCase());
    });
  }, [activeChat, chats, query]);

  const activeName = activeChat?.first_name || activeChat?.name || t('Разговор', 'Conversation', 'Gespräch');

  return (
    <section className={`chat-workspace ${activeChat ? 'has-active-chat' : ''}`} aria-label={t('Сообщения', 'Messages', 'Nachrichten')}>
      <aside className="chat-workspace-contacts">
        <header className="chat-workspace-title">
          <div>
            <span className="eyebrow"><Sparkles size={13} /> VIBE MESSAGES</span>
            <h2>{t('Сообщения', 'Messages', 'Nachrichten')}</h2>
            <p>{t('Разговоры начинаются с взаимного интереса.', 'Good conversations start with mutual interest.', 'Gute Gespräche beginnen mit gegenseitigem Interesse.')}</p>
          </div>
          <span className="chat-count">{chats.length}</span>
        </header>

        <label className="chat-workspace-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Найти разговор', 'Search conversations', 'Gespräche suchen')}
            aria-label={t('Поиск по чатам', 'Search chats', 'Chats durchsuchen')}
          />
        </label>

        <div className="chat-workspace-contact-list">
          {contacts.map((contact) => {
            const id = contactId(contact);
            const name = contact.first_name || contact.name || t('Пользователь', 'VIBE member', 'VIBE-Mitglied');
            const photo = contact.photo_url || contact.avatar_url;
            const online = contact.is_online === true || contact.online === true || contact.online_status === 'online';
            return (
              <button
                type="button"
                key={id}
                className={`chat-workspace-contact ${id === currentId ? 'is-active' : ''}`}
                onClick={() => onOpenChat(contact)}
                aria-current={id === currentId ? 'true' : undefined}
              >
                <span className="chat-workspace-avatar">
                  {photo ? <img src={photo} alt="" loading="lazy" /> : name.slice(0, 1).toUpperCase()}
                  {online && <i aria-label={t('В сети', 'Online', 'Online')} />}
                </span>
                <span className="chat-workspace-contact-copy">
                  <b>{name}</b>
                  <small>{contact.last_message || t('Начни разговор', 'Start a conversation', 'Gespräch beginnen')}</small>
                </span>
                {Number(contact.unread_count || contact.unreadCount) > 0
                  ? <span className="chat-unread">{Number(contact.unread_count || contact.unreadCount)}</span>
                  : <ArrowRight size={15} className="chat-contact-arrow" />}
              </button>
            );
          })}

          {!contacts.length && (
            <div className="chat-workspace-empty">
              <span><MessageCircle size={21} /></span>
              <b>{query ? t('Ничего не найдено', 'No results', 'Keine Ergebnisse') : t('Пока нет чатов', 'No chats yet', 'Noch keine Chats')}</b>
              <p>{query
                ? t('Попробуй другое имя.', 'Try another name.', 'Versuche einen anderen Namen.')
                : t('После взаимной симпатии здесь появятся разговоры.', 'Conversations appear here after a mutual like.', 'Nach gegenseitigem Interesse erscheinen hier Gespräche.')}</p>
            </div>
          )}
        </div>
      </aside>

      <div className="chat-workspace-conversation">
        {activeChat ? (
          <>
            <header className="chat-workspace-conversation-head">
              <button type="button" className="chat-mobile-back" onClick={onBack} aria-label={t('Назад к чатам', 'Back to chats', 'Zurück zu Chats')}>
                <ArrowLeft size={18} />
              </button>
              <span className="chat-workspace-avatar large">
                {(activeChat.photo_url || activeChat.avatar_url)
                  ? <img src={activeChat.photo_url || activeChat.avatar_url} alt="" />
                  : (activeName || 'V').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>{activeName}</b>
                <small>{t('Общение в VIBE', 'Conversation on VIBE', 'Unterhaltung auf VIBE')}</small>
              </div>
              <span className="chat-secure-note"><CheckCheck size={14} /> {t('Твой круг', 'Your circle', 'Dein Kreis')}</span>
            </header>

            <div className="chat-workspace-messages" aria-live="polite">
              {messages.map((message) => {
                const mine = String(message.sender_id ?? message.senderId) === String(user?.id);
                return (
                  <article className={`chat-workspace-message ${mine ? 'mine' : ''}`} key={message.id}>
                    <p>{message.body ?? message.text}</p>
                    <time>{message.created_at || message.createdAt
                      ? new Date(message.created_at || message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}</time>
                  </article>
                );
              })}
              {!messages.length && (
                <div className="chat-first-message">
                  <span><MessageCircle size={22} /></span>
                  <b>{t('Начни с простого приветствия', 'Start with a simple hello', 'Beginne mit einem einfachen Hallo')}</b>
                  <p>{t('Уважительное общение помогает знакомству начаться естественно.', 'A respectful message is a good way to start.', 'Eine respektvolle Nachricht ist ein guter Anfang.')}</p>
                </div>
              )}
            </div>

            <form className="chat-workspace-composer" onSubmit={onSendMessage}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                placeholder={t('Напиши сообщение…', 'Write a message…', 'Nachricht schreiben…')}
                aria-label={t('Сообщение', 'Message', 'Nachricht')}
              />
              <span className="chat-composer-hint">{draft.length}/4000</span>
              <button type="submit" disabled={!draft.trim() || saving} aria-label={t('Отправить сообщение', 'Send message', 'Nachricht senden')}>
                <Send size={17} />
              </button>
            </form>
          </>
        ) : (
          <div className="chat-workspace-welcome">
            <div className="chat-welcome-art"><MessageCircle size={30} /><span><Sparkles size={16} /></span></div>
            <span className="eyebrow">{t('ТВОЁ ПРОСТРАНСТВО ОБЩЕНИЯ', 'YOUR SPACE TO CONNECT', 'DEIN RAUM FÜR KONTAKTE')}</span>
            <h3>{t('Каждый хороший разговор с чего-то начинается.', 'Every good conversation starts somewhere.', 'Jedes gute Gespräch beginnt irgendwo.')}</h3>
            <p>{t('Выбери разговор слева или продолжай знакомиться в ленте VIBE.', 'Choose a conversation on the left or keep discovering people on VIBE.', 'Wähle links einen Chat oder entdecke weiter Menschen auf VIBE.')}</p>
            <button type="button" onClick={onBack}>{t('Вернуться к ленте', 'Back to discovery', 'Zurück zur Entdeckung')} <ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
