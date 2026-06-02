"use client";

import { Icon } from "@/components/Icons";
import { type Property } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { pName, pLoc, fmtTimeLeft } from "../_lib";

export function PropertyCard({
  p,
  isFav,
  onFav,
  onOpen,
  t,
  lang,
  holdMsLeft,
}: {
  p: Property;
  isFav: boolean;
  onFav: () => void;
  onOpen: () => void;
  t: typeof DICT["en"];
  lang: Lang;
  holdMsLeft: number; // 0 = no hold
}) {
  const chips: { id: string; label: string }[] = [
    p.amenities.ac ? { id: "ac", label: t.amenities.ac } : null!,
    p.amenities.kitchen ? { id: "kitchen", label: t.amenities.kitchen } : null!,
    p.amenities.pool ? { id: "pool", label: t.amenities.pool } : null!,
    p.amenities.beachAccess ? { id: "beachAccess", label: t.amenities.beachAccess } : null!,
    p.amenities.parking ? { id: "parking", label: t.amenities.parking } : null!,
    p.amenities.gym ? { id: "gym", label: t.amenities.gym } : null!,
  ].filter(Boolean).slice(0, 4);
  const onHold = holdMsLeft > 0;

  return (
    <div className={`property ${p.country}`} onClick={onOpen}>
      <div className="property-img">
        {p.coverPhoto && (
          <img className="property-img-cover" src={p.coverPhoto} alt={pName(p, lang)} />
        )}
        <span className="property-tag">{p.type}</span>

        {onHold && (
          <div className="property-hold">
            <div>
              <div className="property-hold-badge">⏱ {t.common.onHold}</div>
              <div className="property-hold-time">{fmtTimeLeft(holdMsLeft)}</div>
            </div>
          </div>
        )}
        {p.instantBook && (
          <span className="property-instant"><Icon.Bolt /> {t.common.instantBook}</span>
        )}
        <div style={{ fontSize: 11, fontWeight: 500 }}>{t.common.egypt}</div>
      </div>
      <div className="property-body">
        <div className="property-loc"><Icon.MapPin /> {pLoc(p, lang)}</div>
        <div className="property-name">{pName(p, lang)}</div>
        <div className="property-meta">
          <span><Icon.Bed /> {t.card.br(p.bedrooms)}</span>
          <span><Icon.Bath /> {t.card.bath(p.bathrooms)}</span>
          <span><Icon.Person /> {p.capacity}</span>
          <span><Icon.Area /> {p.area} m²</span>
        </div>
        <div className="property-amenities">
          {chips.map((c) => (
            <span className="amenity-chip" key={c.id}>{c.label}</span>
          ))}
        </div>
        <div className="property-foot">
          <div className="property-price">
            <b>{p.currency} {p.price.toLocaleString()}</b>
            <span>{t.card.perNight}</span>
          </div>
          <div className="property-rating">
            <Icon.Star style={{ color: "var(--yellow-deep)" }} /> {p.rating} <span style={{ color: "var(--muted)" }}>({p.reviews})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
