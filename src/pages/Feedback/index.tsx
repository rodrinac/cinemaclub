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
} from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import PageHeader from "@/components/PageHeader";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";

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
  const { isCompact } = useResponsiveLayout();

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
      <PageHeader title="Feedback" showBack />
      <ScrollView
        style={styles.main}
        contentContainerStyle={[styles.content, { paddingHorizontal: isCompact ? 20 : 32 }]}
      >
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
            <View style={styles.stars} testID="feedback-rating" accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((value) => (
                <AnimatedPressable
                  key={value}
                  borderless
                  onPress={() => setRating(value)}
                  contentStyle={styles.star}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} out of 5, ${RATING_LABELS[value - 1]}`}
                  aria-checked={value === rating}
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
              accessibilityLabel="Feedback message"
              testID="feedback-message-input"
            />

            <AnimatedPressable
              contentStyle={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              testID="feedback-submit-button"
            >
              <Text style={styles.submitButtonLabel}>
                {status === "submitting" ? "Sending…" : "Send feedback"}
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
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: Theme.layout.readingMaxWidth,
    alignSelf: "center",
    paddingVertical: 24,
  },
  sectionHeading: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.title,
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    padding: 14,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.body,
    minHeight: 120,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: Theme.colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonLabel: {
    color: Theme.colors.onGold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.body,
  },
  confirmation: {
    alignItems: "center",
    paddingTop: 48,
  },
  confirmationTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.display,
    marginTop: 16,
  },
  confirmationBody: {
    color: Theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
});
