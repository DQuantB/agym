/**
 * The default @react-navigation/bottom-tabs bar already pads itself by the
 * device's bottom safe-area inset (for the home indicator), so this is a
 * second, independent inset on top of that -- deliberately generous rather
 * than pixel-exact, since the FAB is mounted as a sibling of <Tabs> and
 * can't read the tab bar's actual rendered height from there.
 */
export function fabBottomOffset(insetsBottom: number, tabBarContentHeight: number, gap: number): number {
  return Math.max(insetsBottom, 0) + Math.max(tabBarContentHeight, 0) + gap;
}
