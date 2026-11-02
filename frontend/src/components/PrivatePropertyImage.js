import React, { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

export const PrivatePropertyImage = ({ src, ...props }) => {
  const [objectUrl, setObjectUrl] = useState('');
  const resolvedSrc = src
    ? new URL(src, `${BACKEND_URL || window.location.origin}/`).toString()
    : '';

  useEffect(() => {
    let active = true;
    let currentObjectUrl = '';
    setObjectUrl('');

    if (resolvedSrc) {
      if (!resolvedSrc.includes('/api/files/')) {
        setObjectUrl(resolvedSrc);
        return () => {
          active = false;
        };
      }

      axios.get(resolvedSrc, { responseType: 'blob', withCredentials: true })
        .then(({ data }) => {
          const nextUrl = URL.createObjectURL(data);
          if (!active) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          currentObjectUrl = nextUrl;
          setObjectUrl(nextUrl);
        })
        .catch(() => {
          if (active) setObjectUrl('');
        });
    }

    return () => {
      active = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [resolvedSrc]);

  return <img {...props} src={objectUrl || undefined} />;
};
