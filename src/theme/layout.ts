import { useWindowDimensions } from "react-native";

import Theme from "./index";

export type ResponsiveLayout = {
  width: number;
  height: number;
  isCompact: boolean;
  isWide: boolean;
  isLandscape: boolean;
  /** Width available to page content once the nav rail and max width apply. */
  contentWidth: number;
};

export const getResponsiveLayout = (width: number, height: number): ResponsiveLayout => {
  const isWide = width >= Theme.layout.wideBreakpoint;
  const navWidth = isWide ? Theme.layout.railWidth : 0;

  return {
    width,
    height,
    isCompact: width < Theme.layout.compactBreakpoint,
    isWide,
    isLandscape: width > height,
    contentWidth: Math.min(width - navWidth, Theme.layout.contentMaxWidth),
  };
};

export const useResponsiveLayout = (): ResponsiveLayout => {
  const { width, height } = useWindowDimensions();
  return getResponsiveLayout(width, height);
};

/** Poster grid columns: 2 on phones, then roughly one per 200px of content. */
export const getPosterColumns = (contentWidth: number) =>
  contentWidth < Theme.layout.compactBreakpoint ? 2 : Math.min(6, Math.floor(contentWidth / 200));
