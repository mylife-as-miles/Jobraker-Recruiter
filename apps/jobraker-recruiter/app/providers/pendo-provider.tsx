'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { useEffect, useRef } from 'react';
import { getPendoVisitorData } from '@/app/actions/pendo.actions';

export function PendoProvider() {
  const { user } = useUser();
  const identifiedRef = useRef(false);

  useEffect(() => {
    pendo.initialize({
      visitor: { id: '' },
    });
  }, []);

  useEffect(() => {
    if (!user || identifiedRef.current) return;

    async function identifyUser() {
      try {
        const visitorData = await getPendoVisitorData();
        if (visitorData) {
          pendo.identify({
            visitor: {
              id: visitorData.id,
              email: visitorData.email,
              full_name: visitorData.name,
              auth0Id: visitorData.auth0Id,
              createdAt: visitorData.createdAt,
              updatedAt: visitorData.updatedAt,
              billingCustomerId: visitorData.billingCustomerId,
              subscriptionPlan: visitorData.subscriptionPlan,
              subscriptionStatus: visitorData.subscriptionStatus,
            },
          });
          identifiedRef.current = true;
        }
      } catch (error) {
        console.error('Failed to identify Pendo visitor:', error);
      }
    }

    identifyUser();
  }, [user]);

  return null;
}
