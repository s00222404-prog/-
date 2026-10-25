import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Heart,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';

/**
 * Reusable discovery card. Data and mutations stay owned by App so the
 * component can be reused without bypassing server-side age/access policy.
 */
export default function DiscoveryProfileCard({
  person,
  index,
  userId,
  t,
  notify,
  onSkip,
  onLike,
  onMessage,
  onReport,
}) {
  const favoriteKey = `vibe-favorites:${userId || 'demo'}`;
  const personId = String(person.id);
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
      return Array.isArray(ids) && ids.map(String).includes(personId);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
      setIsFavorite(Array.isArray(ids) && ids.map(String).includes(personId));
    } catch {
      setIsFavorite(false);
    }
  }, [favoriteKey, personId]);

  function toggleFavorite() {
    try {
      const stored = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
      const ids = Array.isArray(stored) ? stored.map(String) : [];
      const next = ids.includes(personId)
        ? ids.filter((id) => id !== personId)
        : [...ids, personId];

      localStorage.setItem(favoriteKey, JSON.stringify(next));
      const saved = next.includes(personId);
      setIsFavorite(saved);
      notify(saved
        ? t('Анкета сохранена', 'Profile saved', 'Profil gespeichert')
        : t('Анкета удалена из сохранённых', 'Profile removed from saved', 'Profil aus Merkliste entfernt'));
    } catch {
      notify(t('Не удалось сохранить анкету', 'Could not save profile', 'Profil konnte nicht gespeichert werden'));
    }
  }

  const mediaUrl = person.media_url || person.photo_url;
  const displayName = person.name || t('Участник VIBE', 'VIBE member', 'VIBE-Mitglied');
  const interests = [
    ...(Array.isArray(person.interests) ? person.interests : []),
    ...(person.hobbies || '').split(/[,;]/).map((item) => item.trim()).filter(Boolean),
  ].slice(0, 3);

  return (
    <article className="discover-person-card" data-profile-id={personId}>
      <div className="discover-person-photo">
        {person.media_type === 'video' && person.media_url ? (
          <video src={person.media_url} muted loop playsInline autoPlay preload="metadata" />
        ) : mediaUrl ? (
          <img
            src={mediaUrl}
            alt={displayName}
            loading={index > 3 ? 'lazy' : 'eager'}
            decoding="async"
          />
        ) : (
          <div className="discover-person-placeholder" aria-hidden="true">
            {(displayName || 'V').slice(0, 1)}
          </div>
        )}
        <div className="discover-photo-shade" />
        <span className="discover-match">
          <Sparkles size={12} aria-hidden="true" />
          {t('ТЕБЕ МОЖЕТ ПОНРАВИТЬСЯ', 'YOU MAY CLICK', 'KÖNNTE DIR GEFALLEN')}
        </span>
        <button
          type="button"
          className={`discover-save ${isFavorite ? 'is-saved' : ''}`}
          aria-label={isFavorite
            ? t('Убрать из сохранённых', 'Remove from saved', 'Aus Merkliste entfernen')
            : t('Сохранить анкету', 'Save profile', 'Profil speichern')}
          aria-pressed={isFavorite}
          onClick={toggleFavorite}
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <div className="discover-person-overlay">
          <h3>
            {displayName}
            {Number.isInteger(Number(person.age)) && Number(person.age) > 0
              ? `, ${person.age}`
              : ''}
          </h3>
          <div>
            <MapPin size={13} aria-hidden="true" />
            {[
              person.city,
              person.country,
            ].filter(Boolean).join(', ') || t('Местоположение не указано', 'Location not set', 'Standort nicht angegeben')}
          </div>
        </div>
      </div>

      <div className="discover-person-content">
        <p>
          {person.description || person.bio || t('Пока ничего не рассказал о себе.', 'No bio yet.', 'Noch keine Beschreibung.')}
        </p>
        <div className="discover-tags">
          {interests.map((tag, tagIndex) => (
            <span key={`${tag}-${tagIndex}`}>{tag}</span>
          ))}
        </div>
        <div className="discover-person-actions">
          <button
            type="button"
            className="discover-pass"
            onClick={onSkip}
            title={t('Пропустить', 'Skip', 'Überspringen')}
            aria-label={t('Пропустить анкету', 'Pass on profile', 'Profil überspringen')}
          >
            <X size={17} />
          </button>
          <button type="button" className="discover-like" onClick={onLike}>
            <Heart size={17} aria-hidden="true" />
            {t('Есть вайб', 'Like', 'Gefällt mir')}
          </button>
          <button
            type="button"
            className="discover-message"
            onClick={onMessage}
            aria-label={t('Написать', 'Message', 'Nachricht')}
          >
            <MessageCircle size={17} />
          </button>
          <button
            type="button"
            className="discover-report"
            onClick={onReport}
            aria-label={t('Пожаловаться', 'Report', 'Melden')}
          >
            <ShieldAlert size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
