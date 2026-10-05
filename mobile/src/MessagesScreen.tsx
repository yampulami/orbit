import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import Input from "./FocusInput";
import ModalSafeArea from "./ModalSafeArea";
import Touch from "./Touch";
import { validCampus } from "../../src/campus";
import {
  createCampusGroup,
  fetchCampusGroups,
  fetchGroupMessages,
  joinCampusGroup,
  sendGroupMessage,
  subscribeCampusMessages,
  type CampusGroup,
  type GroupMessage,
} from "./campusMessages";
import { theme as t } from "./theme";

export default function MessagesScreen({
  accountId,
  campus,
  author,
  profile,
}: {
  accountId?: string;
  campus: string;
  author: string;
  profile: () => void;
}) {
  const live = !!accountId && validCampus(campus);
  const [groups, setGroups] = useState<CampusGroup[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(live);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const active = groups.find((group) => group.id === activeId);
  const loadGroups = useCallback(async () => {
    if (!live) return;
    try {
      const next = await fetchCampusGroups(campus);
      setGroups(next);
      setActiveId((current) => {
        const available = next.find((group) => group.id === current && group.joined);
        return available?.id ?? next.find((group) => group.joined)?.id ?? "";
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Messages couldn’t load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campus, live]);
  const loadMessages = useCallback(async () => {
    if (!activeId) { setMessages([]); return; }
    try {
      setMessages(await fetchGroupMessages(activeId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This conversation couldn’t load.");
    }
  }, [activeId]);
  useEffect(() => { void loadGroups(); }, [loadGroups]);
  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useEffect(() => subscribeCampusMessages(campus, () => {
    void loadGroups();
    void loadMessages();
  }), [campus, loadGroups, loadMessages]);
  useEffect(() => {
    if (messages.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 40);
  }, [messages.length]);

  async function send() {
    if (!activeId || !body.trim() || busy) return;
    const text = body.trim();
    setBody("");
    setBusy(true);
    try {
      await sendGroupMessage(activeId, randomUUID(), author, text);
      await loadMessages();
    } catch (e) {
      setBody(text);
      setError(e instanceof Error ? e.message : "Message couldn’t be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createCampusGroup(campus, groupName, description);
      setCreating(false);
      setGroupName("");
      setDescription("");
      await loadGroups();
      setActiveId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Group couldn’t be created.");
    } finally {
      setBusy(false);
    }
  }

  if (!live)
    return (
      <View style={s.center}>
        <Ionicons name="chatbubbles-outline" size={38} color={t.active} />
        <Text style={s.title}>{accountId ? "Choose your university" : "Sign in for messages"}</Text>
        <Text style={s.caption}>Group conversations stay inside your university.</Text>
        <Touch accessibilityRole="button" onPress={profile} style={s.primary}>
          <Text style={s.primaryText}>{accountId ? "Open profile" : "View account"}</Text>
        </Touch>
      </View>
    );

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.heading}>Messages</Text>
          <Text style={s.caption}>{campus}</Text>
        </View>
        <Touch accessibilityRole="button" accessibilityLabel="Create group chat" onPress={() => setCreating(true)} style={s.iconButton}>
          <Ionicons name="add" size={25} color={t.text} />
        </Touch>
      </View>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {loading ? <ActivityIndicator color={t.active} style={{ marginTop: 40 }} /> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupTabs}>
            {groups.filter((group) => group.joined).map((group) => (
              <Touch key={group.id} accessibilityRole="tab" accessibilityState={{ selected: activeId === group.id }} onPress={() => setActiveId(group.id)} style={[s.groupTab, activeId === group.id && s.groupTabActive]}>
                <Text style={[s.groupTabText, activeId === group.id && { color: t.text }]}>{group.name}</Text>
              </Touch>
            ))}
          </ScrollView>
          {active && (
            <View style={s.conversationHead}>
              <View style={s.groupMark}><Text style={s.groupInitial}>{active.name[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{active.name}</Text>
                <Text numberOfLines={1} style={s.caption}>{active.description || "Campus group chat"}</Text>
              </View>
            </View>
          )}
          <ScrollView
            ref={scroll}
            style={s.messages}
            contentContainerStyle={s.messageContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.active} colors={[t.active]} onRefresh={() => { setRefreshing(true); void Promise.all([loadGroups(), loadMessages()]); }} />}
          >
            {!messages.length && active && (
              <View style={s.empty}>
                <Text style={s.title}>Start the conversation</Text>
                <Text style={s.caption}>Everyone who joins {active.name} can see messages here.</Text>
              </View>
            )}
            {messages.map((message) => (
              <View key={message.id} style={[s.bubbleRow, message.mine && { justifyContent: "flex-end" }]}>
                <View style={[s.bubble, message.mine && s.mine]}>
                  {!message.mine && <Text style={s.sender}>{message.senderName}</Text>}
                  <Text style={s.messageText}>{message.body}</Text>
                  <Text style={s.time}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                </View>
              </View>
            ))}
            {!!groups.find((group) => !group.joined) && (
              <View style={s.discover}>
                <Text style={s.section}>Discover campus groups</Text>
                {groups.filter((group) => !group.joined).map((group) => (
                  <View key={group.id} style={s.discoverRow}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={s.title}>{group.name}</Text>
                      <Text style={s.caption}>{group.description || "Campus group chat"}</Text>
                    </View>
                    <Touch accessibilityRole="button" onPress={() => { void joinCampusGroup(group.id).then(loadGroups).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t join group.")); }} style={s.join}>
                      <Text style={s.joinText}>Join</Text>
                    </Touch>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          {!!active && (
            <View style={s.composer}>
              <Input accessibilityLabel={`Message ${active.name}`} value={body} onChangeText={setBody} placeholder="Message the group…" placeholderTextColor={t.muted} maxLength={2000} multiline style={s.input} />
              <Touch accessibilityRole="button" accessibilityLabel="Send message" disabled={!body.trim() || busy} onPress={() => { void send(); }} style={[s.send, (!body.trim() || busy) && { opacity: 0.4 }]}>
                <Ionicons name="arrow-up" size={22} color={t.text} />
              </Touch>
            </View>
          )}
        </>
      )}
      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <ModalSafeArea style={s.modal}>
          <View style={s.modalHeader}>
            <Touch accessibilityRole="button" accessibilityLabel="Close new group" onPress={() => setCreating(false)} style={s.iconButton}><Ionicons name="close" size={25} color={t.text} /></Touch>
            <Text style={s.title}>New group chat</Text>
            <Touch accessibilityRole="button" disabled={!groupName.trim() || busy} onPress={() => { void create(); }} style={s.iconButton}><Text style={[s.joinText, (!groupName.trim() || busy) && { opacity: 0.4 }]}>Create</Text></Touch>
          </View>
          <View style={s.form}>
            <Text style={s.caption}>Groups are visible to everyone at {campus}. Students choose whether to join.</Text>
            <Input accessibilityLabel="Group name" value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={t.muted} maxLength={100} style={s.formInput} />
            <Input accessibilityLabel="Group description" value={description} onChangeText={setDescription} placeholder="What is this group for?" placeholderTextColor={t.muted} maxLength={500} multiline style={[s.formInput, { minHeight: 120 }]} />
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          </View>
        </ModalSafeArea>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  header: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: t.line },
  heading: { color: t.text, fontSize: 25, fontWeight: "600", letterSpacing: -0.7 },
  title: { color: t.text, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  caption: { color: t.muted, fontSize: 12, lineHeight: 18 },
  iconButton: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  groupTabs: { minHeight: 48, paddingHorizontal: 18, gap: 20, borderBottomWidth: 1, borderColor: t.line },
  groupTab: { justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  groupTabActive: { borderBottomColor: t.active },
  groupTabText: { color: t.muted, fontSize: 13 },
  conversationHead: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderColor: t.line },
  groupMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.raised, alignItems: "center", justifyContent: "center" },
  groupInitial: { color: t.active, fontSize: 16 },
  messages: { flex: 1 },
  messageContent: { padding: 18, gap: 9, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "82%", backgroundColor: t.surface, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 9, gap: 3 },
  mine: { backgroundColor: t.teal, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  sender: { color: t.active, fontSize: 11, fontWeight: "600" },
  messageText: { color: t.text, fontSize: 14, lineHeight: 20 },
  time: { color: t.muted, fontSize: 9, alignSelf: "flex-end" },
  empty: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 44 },
  discover: { marginTop: 24, borderTopWidth: 1, borderColor: t.line },
  section: { color: t.muted, fontSize: 11, paddingVertical: 15, textTransform: "uppercase", letterSpacing: 1.2 },
  discoverRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: 1, borderColor: t.line },
  join: { minWidth: 60, minHeight: 40, borderRadius: 20, backgroundColor: t.raised, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  joinText: { color: t.active, fontSize: 13, fontWeight: "600" },
  composer: { flexDirection: "row", gap: 10, alignItems: "flex-end", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: t.line },
  input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: t.surface, borderRadius: 23, paddingHorizontal: 16, paddingVertical: 11, color: t.text },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.teal, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: t.background },
  primary: { marginTop: 8, minHeight: 46, borderRadius: 23, backgroundColor: t.teal, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  primaryText: { color: t.text, fontSize: 14, fontWeight: "600" },
  error: { color: "#e8ad9f", fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: t.background },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: t.line, paddingHorizontal: 10 },
  form: { padding: 22, gap: 18 },
  formInput: { color: t.text, fontSize: 16, backgroundColor: t.surface, borderRadius: 10, padding: 14 },
});
