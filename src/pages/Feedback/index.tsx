import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

const RATING_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

/**
 * Submits the user's feedback.
 *
 * NOTE: this is a stub — it does not make a real network request yet.
 * Replace the body of this function with the actual HTTP call once the
 * feedback endpoint is available.
 */
async function submitFeedback(payload: { rating: number; message: string }): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[Feedback] submitFeedback (stub, no HTTP request yet):", payload);
}

const Feedback = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");

  const canSubmit = rating > 0 && status !== "submitting";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setStatus("submitting");
    await submitFeedback({ rating, message: message.trim() });
    setStatus("submitted");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      testID="feedback-page"
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <AnimatedPressable borderless onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
        </View>
        <Text style={[styles.title, { fontSize: isLandscape ? 26 : 32 }]}>FEEDBACK</Text>
      </View>
      <ScrollView style={styles.main} contentContainerStyle={styles.content}>
        {status === "submitted" ? (
          <View style={styles.confirmation} testID="feedback-confirmation">
            <Ionicons name="checkmark-circle" size={48} color={Theme.colors.gold} />
            <Text style={styles.confirmationTitle}>Thanks for your feedback!</Text>
            <Text style={styles.confirmationBody}>
              We appreciate you taking the time to help us improve Cinema Club.
            </Text>
            <AnimatedPressable
              contentStyle={styles.submitButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.submitButtonLabel}>Done</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionHeading}>How would you rate your experience?</Text>
            <View style={styles.stars} testID="feedback-rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <AnimatedPressable
                  key={value}
                  borderless
                  onPress={() => setRating(value)}
                  contentStyle={styles.star}
                >
                  <Ionicons
                    name={value <= rating ? "star" : "star-outline"}
                    size={36}
                    color={Theme.colors.gold}
                    testID={`feedback-star-${value}`}
                  />
                </AnimatedPressable>
              ))}
            </View>
            {rating > 0 && <Text style={styles.ratingLabel}>{RATING_LABELS[rating - 1]}</Text>}

            <Text style={styles.sectionHeading}>Tell us more (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="What do you like, or what could be better?"
              placeholderTextColor={Theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              testID="feedback-message-input"
            />

            <AnimatedPressable
              contentStyle={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              testID="feedback-submit-button"
            >
              <Text style={styles.submitButtonLabel}>
                {status === "submitting" ? "Sending..." : "Send Feedback"}
              </Text>
            </AnimatedPressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Feedback;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.primary,
    elevation: 4,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: "RobotoCondensed_700Bold",
    maxWidth: "100%",
    marginTop: 16,
    marginBottom: 16,
  },
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  sectionHeading: {
    color: Theme.colors.text,
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 18,
    marginBottom: 12,
    marginTop: 12,
  },
  stars: {
    flexDirection: "row",
    justifyContent: "center",
  },
  star: {
    padding: 6,
  },
  ratingLabel: {
    color: Theme.colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  messageInput: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    color: Theme.colors.text,
    minHeight: 120,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: Theme.colors.gold,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonLabel: {
    color: Theme.colors.primaryDarker,
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 16,
  },
  confirmation: {
    alignItems: "center",
    paddingTop: 48,
  },
  confirmationTitle: {
    color: Theme.colors.text,
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 20,
    marginTop: 16,
  },
  confirmationBody: {
    color: Theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
});
