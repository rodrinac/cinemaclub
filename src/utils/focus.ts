import { Platform } from "react-native";

/**
 * Blurs the currently focused DOM element on web before navigating away.
 *
 * react-navigation's stack navigator marks the outgoing screen with
 * `aria-hidden="true"` as soon as the new screen becomes active. If the
 * element that was just pressed (e.g. a movie poster) still has DOM focus
 * at that point, the browser logs "Blocked aria-hidden on an element
 * because its descendant retained focus" and assistive tech can end up
 * stuck on a hidden element. Blurring before navigating avoids the clash,
 * mirroring the same fix already used for the trailer modal.
 */
export const blurActiveElementBeforeNavigate = () => {
  if (Platform.OS !== "web") {
    return;
  }

  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
};
