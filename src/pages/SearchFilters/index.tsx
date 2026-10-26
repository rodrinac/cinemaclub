import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import * as database from "@/api/database";
import api, { TmdbGenre, TmdbGenreList } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import GenreCard from "@/components/GenreCard";
import PageHeader from "@/components/PageHeader";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";

type FilterModeOption = {
  value: Exclude<database.GenreFilterMode, "UNDEFINED">;
  label: string;
  hint: string;
};

const FILTER_MODES: FilterModeOption[] = [
  {
    value: "INCLUDING",
    label: "Include",
    hint: "Show only movies in at least one of the genres you pick.",
  },
  {
    value: "EXCLUDING",
    label: "Exclude",
    hint: "Hide movies in any of the genres you pick.",
  },
];

const toRows = (genres: TmdbGenre[], columns: number) =>
  Array.from({ length: Math.ceil(genres.length / columns) }, (_, index) =>
    genres.slice(index * columns, (index + 1) * columns),
  );

const SearchFilters = () => {
  const { isCompact, isWide, height } = useResponsiveLayout();
  const columns = isWide ? 4 : isCompact ? 2 : 3;
  // The stack card on web grows with its content and the body can't scroll, so the
  // screen has to be pinned to the window for the genre grid to scroll by itself.
  const screenWebStyle =
    Platform.OS === "web"
      ? {
          overflow: "hidden" as const,
          height,
          maxHeight: height,
        }
      : null;

  const [genreList, setGenreList] = useState<TmdbGenreList | undefined>();
  const [filterMode, setFilterMode] = useState<database.GenreFilterMode>("INCLUDING");

  useEffect(() => {
    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>("genres");

      setGenreList(response.data);
    }

    fetchGenres();
  }, []);

  useEffect(() => {
    async function fetchGenreFilter() {
      const mode = await database.getGenreFilterMode();

      if (mode !== "UNDEFINED") {
        setFilterMode(mode);
      }
    }

    fetchGenreFilter();
  }, []);

  const onFilterModeChange = (newFilter: database.GenreFilterMode) => {
    (async () => {
      await database.setGenreFilterMode(newFilter);
    })();
    setFilterMode(newFilter);
  };

  const rows = useMemo(() => toRows(genreList?.genres ?? [], columns), [genreList, columns]);
  const activeMode = FILTER_MODES.find((mode) => mode.value === filterMode) ?? FILTER_MODES[0];

  return (
    <View style={[styles.root, screenWebStyle]}>
      <AppShell active="SearchMovie">
        <PageHeader title="Filters" showBack>
          <View style={styles.modeSection}>
            <View
              style={styles.segmented}
              accessibilityRole="radiogroup"
              accessibilityLabel="Genre filter mode"
            >
              {FILTER_MODES.map((mode) => {
                const isSelected = mode.value === activeMode.value;

                return (
                  <AnimatedPressable
                    key={mode.value}
                    borderless
                    style={[styles.segment, isSelected ? styles.segmentSelected : null]}
                    contentStyle={styles.segmentContent}
                    onPress={() => onFilterModeChange(mode.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={mode.label}
                    aria-checked={isSelected}
                    testID={`filter-mode-${mode.value.toLowerCase()}`}
                  >
                    <Text
                      style={[styles.segmentLabel, isSelected ? styles.segmentLabelSelected : null]}
                    >
                      {mode.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{activeMode.hint}</Text>
          </View>
        </PageHeader>
        <ScrollView
          style={styles.main}
          contentContainerStyle={[styles.gridContent, { paddingHorizontal: isCompact ? 20 : 32 }]}
        >
          {rows.map((row) => (
            <View key={row[0].id} style={styles.gridRow}>
              {row.map((genre) => (
                <GenreCard key={genre.id} genre={genre} filterMode={filterMode} />
              ))}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`spacer-${index}`} style={styles.spacer} />
              ))}
            </View>
          ))}
        </ScrollView>
      </AppShell>
    </View>
  );
};

export default SearchFilters;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modeSection: {
    gap: 8,
  },
  segmented: {
    flexDirection: "row",
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: 360,
    gap: 3,
    padding: 3,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  segment: {
    flex: 1,
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: Theme.colors.surfaceAlt,
  },
  segmentContent: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  segmentLabel: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
  },
  segmentLabelSelected: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
  },
  hint: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
    lineHeight: 18,
  },
  main: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.colors.background,
  },
  gridContent: {
    width: "100%",
    maxWidth: Theme.layout.contentMaxWidth,
    alignSelf: "center",
    paddingVertical: 16,
    gap: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  // Keeps the last row's cards as wide as the rest; same border box as a GenreCard.
  spacer: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.background,
  },
});
