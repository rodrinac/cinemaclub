import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { getBookmarks } from "@/api/database";
import type { TmdbMovie } from "@/api/tmdb";
import { getMovieDetails } from "@/api/tmdb/movieDetailsCache";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import VerticalMovieCard from "@/components/VerticalMovieCard";
import Theme from "@/theme";
import { getPosterColumns, useResponsiveLayout } from "@/theme/layout";
import { blurActiveElementBeforeNavigate } from "@/utils/focus";

const Saved = () => {
  const navigation = useNavigation();
  const { contentWidth, isCompact } = useResponsiveLayout();
  const columns = getPosterColumns(contentWidth);
  const [savedIds, setSavedIds] = useState<number[]>();

  // Bookmarks change on other screens, so re-read them whenever Saved is shown.
  useFocusEffect(
    useCallback(() => {
      getBookmarks().then(setSavedIds);
    }, []),
  );

  const {
    data: movies,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["saved-movies", savedIds],
    queryFn: () => Promise.all((savedIds ?? []).map((movieId) => getMovieDetails(movieId))),
    enabled: (savedIds?.length ?? 0) > 0,
  });

  const openMovie = (movie: TmdbMovie) => {
    blurActiveElementBeforeNavigate();
    navigation.navigate("MovieDetail", { movieId: movie.id });
  };

  const renderBody = () => {
    if (!savedIds) return null;

    if (savedIds.length === 0) {
      return (
        <View style={styles.state} testID="saved-empty-state">
          <Ionicons name="bookmark-outline" size={40} color={Theme.colors.textMuted} />
          <Text style={styles.stateTitle}>Save movies to watch later</Text>
          <Text style={styles.stateBody}>Tap the bookmark on any movie to keep it here.</Text>
          <AnimatedPressable
            onPress={() => navigation.navigate("Home")}
            accessibilityRole="button"
            contentStyle={styles.stateAction}
          >
            <Text style={styles.stateActionText}>Discover movies</Text>
          </AnimatedPressable>
        </View>
      );
    }

    if (isPending) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={Theme.colors.gold} />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Couldn't load your saved movies</Text>
          <AnimatedPressable
            onPress={() => refetch()}
            accessibilityRole="button"
            contentStyle={styles.stateAction}
          >
            <Text style={styles.stateActionText}>Retry</Text>
          </AnimatedPressable>
        </View>
      );
    }

    return (
      <FlatList
        key={`saved-columns-${columns}`}
        data={movies}
        numColumns={columns}
        keyExtractor={(movie) => movie.id.toString()}
        renderItem={({ item }) => (
          <VerticalMovieCard movie={item} columns={columns} onPosterPress={() => openMovie(item)} />
        )}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: isCompact ? 14 : 26 }]}
        testID="saved-movie-list"
      />
    );
  };

  return (
    <AppShell active="Saved">
      <PageHeader title="Saved" />
      <View style={styles.main}>{renderBody()}</View>
    </AppShell>
  );
};

export default Saved;

const styles = StyleSheet.create({
  main: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    width: "100%",
    maxWidth: Theme.layout.contentMaxWidth,
    alignSelf: "center",
    paddingVertical: 12,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.title,
    textAlign: "center",
  },
  stateBody: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
    textAlign: "center",
  },
  stateAction: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stateActionText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.meta,
  },
});
