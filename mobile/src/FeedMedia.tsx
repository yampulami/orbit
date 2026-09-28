import React from "react";
import { Image, Platform, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import type { Media } from "../../src/feed";
import { theme as t } from "./theme";
export async function pickFeedMedia(): Promise<Media | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: Platform.OS === "web" ? ["images"] : ["images", "videos"],
    quality: 0.65,
    base64: Platform.OS === "web",
    videoMaxDuration: 60,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if ((asset.fileSize ?? 0) > 40 * 1024 * 1024)
    throw new Error("Choose a photo or video under 40 MB.");
  if (Platform.OS === "web") {
    if (!asset.base64 || asset.base64.length > 2_000_000)
      throw new Error(
        "For the browser preview, choose a smaller photo (under 1.5 MB). Video uploads are available on the phone.",
      );
    return {
      type: "image",
      uri: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`,
    };
  }
  return { type: asset.type === "video" ? "video" : "image", uri: asset.uri };
}
export function retainFeedMedia(media: Media | undefined, id: string) {
  if (!media || Platform.OS === "web" || !media.uri.startsWith("file:"))
    return media;
  const source = new File(media.uri);
  const file = new File(
    Paths.document,
    `orbit-post-${id}${source.extension || (media.type === "video" ? ".mp4" : ".jpg")}`,
  );
  source.copy(file);
  return { ...media, uri: file.uri };
}
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  return (
    <View>
      {status === "error" ? (
        <Text style={{ color: t.muted, padding: 18 }}>
          This video is unavailable on this device.
        </Text>
      ) : (
        <VideoView
          player={player}
          style={{ width: "100%", height: 220 }}
          nativeControls
          contentFit="contain"
        />
      )}
    </View>
  );
}
export default function FeedMedia({ media }: { media: Media }) {
  const [failed, setFailed] = React.useState(false);
  if (failed)
    return (
      <Text style={{ color: t.muted, padding: 18 }}>
        This image is unavailable on this device.
      </Text>
    );
  return media.type === "video" ? (
    <Video uri={media.uri} />
  ) : (
    <Image
      source={{ uri: media.uri }}
      accessibilityLabel="Post attachment"
      style={{
        width: "100%",
        height: 220,
        borderRadius: 8,
        backgroundColor: t.surface,
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
