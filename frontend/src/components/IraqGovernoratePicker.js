import React, { useId } from 'react';
import { IRAQI_GOVERNORATES } from '../data/iraqGovernorates';
import './IraqGovernoratePicker.css';

const DISPLAY_ORDER = [
  ...IRAQI_GOVERNORATES.filter((governorate) => governorate.id !== 'IQ-HJ'),
  ...IRAQI_GOVERNORATES.filter((governorate) => governorate.id === 'IQ-HJ'),
];

export const IraqGovernoratePicker = ({
  value = '',
  onChange,
  compact = false,
  title = 'اختيار المحافظة',
  resultCount,
  loading = false,
  selectTestId = 'governorate-select',
  className = '',
}) => {
  const selected = IRAQI_GOVERNORATES.find((governorate) => governorate.name === value);
  const selectId = useId();
  const selectGovernorate = (name) => {
    if (typeof onChange === 'function') onChange(name);
  };
  const handleMapKeyDown = (event, name) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectGovernorate(name);
    }
  };

  return (
    <section className={`iraq-governorate-picker${compact ? ' is-compact' : ''} ${className}`.trim()} aria-label="اختيار محافظة عراقية" dir="rtl">
      <div className="iraq-picker-heading">
        <div>
          <h3>{title}</h3>
          <p>اضغط على المحافظة في الخريطة أو اختارها من القائمة.</p>
        </div>
        <span className="iraq-governorate-count">١٩ محافظة</span>
      </div>

      <div className="iraq-picker-content">
        <div className="iraq-map-surface">
          <svg
            className="iraq-governorate-map"
            viewBox="0 0 760 700"
            role="group"
            aria-label="خريطة تفاعلية لمحافظات العراق"
            preserveAspectRatio="xMidYMid meet"
          >
            {DISPLAY_ORDER.map((governorate) => (
              <path
                key={governorate.id}
                d={governorate.d}
                className={`iraq-map-region${selected?.id === governorate.id ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={governorate.name}
                aria-pressed={selected?.id === governorate.id}
                onClick={() => selectGovernorate(governorate.name)}
                onKeyDown={(event) => handleMapKeyDown(event, governorate.name)}
              />
            ))}
            {IRAQI_GOVERNORATES.map((governorate) => (
              <text
                key={`${governorate.id}-label`}
                className={`iraq-map-label${selected?.id === governorate.id ? ' is-selected' : ''}`}
                x={governorate.labelX}
                y={governorate.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                fontSize={governorate.name.length > 8 ? 10 : 11}
              >
                {governorate.name}
              </text>
            ))}
          </svg>
          <span className="iraq-map-north" aria-hidden="true">شمال</span>
        </div>

        <div className="iraq-picker-controls">
          <label htmlFor={selectId}>المحافظة</label>
          <select
            id={selectId}
            data-testid={selectTestId}
            value={value}
            onChange={(event) => selectGovernorate(event.target.value)}
          >
            <option value="">كل المحافظات</option>
            {value && !selected && <option value={value}>قيمة محفوظة: {value}</option>}
            {IRAQI_GOVERNORATES.map((governorate) => (
              <option key={governorate.id} value={governorate.name}>{governorate.name}</option>
            ))}
          </select>

          {selected ? (
            <div className="iraq-selection-card" aria-live="polite">
              <span className="iraq-selection-pin" aria-hidden="true">●</span>
              <div>
                <strong>{selected.name}</strong>
                <span>
                  {loading
                    ? 'جارٍ تحديث النتائج…'
                    : Number.isFinite(resultCount)
                      ? `${resultCount.toLocaleString('ar-IQ')} عقار ضمن النتائج`
                      : 'تم اختيار المحافظة'}
                </span>
              </div>
              <button type="button" onClick={() => selectGovernorate('')} aria-label="مسح اختيار المحافظة">مسح</button>
            </div>
          ) : (
            <p className="iraq-picker-hint">اختار محافظة حتى تظهر العقارات المسجلة فيها.</p>
          )}
        </div>
      </div>

      <p className="iraq-map-attribution">
        الخريطة للتحديد التقريبي للموقع. الحدود ليست مرجعاً قانونياً أو مساحياً. حدود حلبجة والسليمانية ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">مساهمو OpenStreetMap</a> (ODbL)؛{' '}
        بقية الحدود من <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>.
      </p>
    </section>
  );
};
