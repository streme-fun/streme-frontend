"use client";

import { usePostHog } from "posthog-js/react";

export const CHECKIN_EVENTS = {
  MODAL_SHOWN: "checkin_modal_shown",
  MODAL_AUTO_SHOWN: "checkin_modal_auto_shown",
  CLAIM_CLICKED: "checkin_claim_clicked",
  MODAL_CLOSED: "checkin_modal_closed",
  DEBUG_BUTTON_CLICKED: "checkin_debug_button_clicked",
} as const;

export function useCheckinTracking() {
  const postHog = usePostHog();

  const trackModalShown = (hasStakedBalance: boolean, hasAlreadyCheckedIn: boolean) => {
    postHog?.capture(CHECKIN_EVENTS.MODAL_SHOWN, {
      has_staked_balance: hasStakedBalance,
      has_already_checked_in: hasAlreadyCheckedIn,
    });
  };

  const trackModalAutoShown = (hasStakedBalance: boolean) => {
    postHog?.capture(CHECKIN_EVENTS.MODAL_AUTO_SHOWN, {
      has_staked_balance: hasStakedBalance,
    });
  };

  const trackClaimClicked = (hasStakedBalance: boolean, messageShown: string) => {
    postHog?.capture(CHECKIN_EVENTS.CLAIM_CLICKED, {
      has_staked_balance: hasStakedBalance,
      message_shown: messageShown,
    });
  };

  const trackModalClosed = (
    hasStakedBalance: boolean,
    hasAlreadyCheckedIn: boolean,
    closedWithoutClaiming: boolean
  ) => {
    postHog?.capture(CHECKIN_EVENTS.MODAL_CLOSED, {
      has_staked_balance: hasStakedBalance,
      has_already_checked_in: hasAlreadyCheckedIn,
      closed_without_claiming: closedWithoutClaiming,
    });
  };

  const trackDebugButtonClicked = (hasStakedBalance: boolean) => {
    postHog?.capture(CHECKIN_EVENTS.DEBUG_BUTTON_CLICKED, {
      has_staked_balance: hasStakedBalance,
    });
  };

  return {
    trackModalShown,
    trackModalAutoShown,
    trackClaimClicked,
    trackModalClosed,
    trackDebugButtonClicked,
  };
}