import React, { useEffect, useRef, useState } from 'react';

export default function DestinationMap({ destinations, selectedId, onMarkerClick, height = 400 }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Ждём загрузки API Яндекс Карт
  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(() => setReady(true));
    } else {
      const interval = setInterval(() => {
        if (window.ymaps) {
          clearInterval(interval);
          window.ymaps.ready(() => setReady(true));
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const withCoords = destinations.filter(d => d.latitude && d.longitude);
    if (!withCoords.length) return;

    // Удаляем старую карту
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    const avgLat = withCoords.reduce((s, d) => s + Number(d.latitude), 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, d) => s + Number(d.longitude), 0) / withCoords.length;

    const map = new window.ymaps.Map(mapRef.current, {
      center: [avgLat, avgLng],
      zoom: withCoords.length === 1 ? 8 : 2,
      controls: ['zoomControl', 'fullscreenControl']
    }, {
      suppressMapOpenBlock: true
    });

    instanceRef.current = map;

    withCoords.forEach(dest => {
      const isSelected = dest.id === selectedId;

      const placemark = new window.ymaps.Placemark(
        [Number(dest.latitude), Number(dest.longitude)],
        {
          balloonContentHeader: dest.name,
          balloonContentBody: `
            ${dest.image_url ? `<img src="${dest.image_url}" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:8px">` : ''}
            <div style="font-size:12px;color:#888;text-transform:uppercase">${dest.country}</div>
            <div style="font-size:14px;color:#c9a84c;font-weight:600;margin-top:4px">
              ${Number(dest.price).toLocaleString('ru-RU')} ₽ / чел.
            </div>
            <div style="font-size:12px;color:#666;margin-top:2px">${dest.duration} дней</div>
          `,
          balloonContentFooter: '',
          hintContent: dest.name
        },
        {
          preset: isSelected
            ? 'islands#yellowDotIcon'
            : 'islands#orangeDotIcon',
          iconColor: isSelected ? '#e8c97a' : '#c9a84c',
        }
      );

      placemark.events.add('click', () => {
        onMarkerClick && onMarkerClick(dest);
      });

      map.geoObjects.add(placemark);
    });

    // Подгоняем под все маркеры
    if (withCoords.length > 1) {
      map.setBounds(map.geoObjects.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 50
      });
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [ready, destinations, selectedId]);

  const withCoords = destinations.filter(d => d.latitude && d.longitude);
  if (!withCoords.length) return null;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      height
    }}>
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(14,14,18,0.8)'
        }}>
          <div className="spinner" style={{ margin: 0 }} />
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
