import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import Input from "./FocusInput";
import ModalSafeArea from "./ModalSafeArea";
import Touch from "./Touch";
import { validCampus } from "../../src/campus";
import { createCampusGroup, fetchCampusGroups, fetchGroupMessages, joinCampusGroup, sendGroupMessage, subscribeCampusMessages, type CampusGroup, type GroupMessage } from "./campusMessages";
import { fetchDirectMessages, fetchDirectThreads, openDirectConversation, sendDirectMessage, subscribeCampusSocial, type DirectMessage, type DirectThread } from "./campusSocial";
import { theme as t } from "./theme";

type Props = { accountId?: string; campus: string; author: string; profile: () => void; directPeer?: { id: string; name: string } | null; directOpened?: () => void };

export default function MessagesScreen({ accountId, campus, author, profile, directPeer, directOpened }: Props) {
  const live = !!accountId && validCampus(campus);
  const [mode, setMode] = useState<"Direct" | "Groups">("Direct");
  const [groups, setGroups] = useState<CampusGroup[]>([]), [activeGroupId, setActiveGroupId] = useState(""), [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [threads, setThreads] = useState<DirectThread[]>([]), [activeDirectId, setActiveDirectId] = useState(""), [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [pendingPeerName, setPendingPeerName] = useState(""), [body, setBody] = useState(""), [error, setError] = useState("");
  const [loading, setLoading] = useState(live), [refreshing, setRefreshing] = useState(false), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState(""), [description, setDescription] = useState("");
  const scroll = useRef<ScrollView>(null);
  const activeGroup = groups.find((x) => x.id === activeGroupId), activeThread = threads.find((x) => x.id === activeDirectId);
  const activeName = activeThread?.peerName ?? pendingPeerName;

  const loadGroups = useCallback(async () => {
    if (!live) return;
    const next = await fetchCampusGroups(campus);
    setGroups(next);
    setActiveGroupId((current) => next.find((x) => x.id === current && x.joined)?.id ?? next.find((x) => x.joined)?.id ?? "");
  }, [campus, live]);
  const loadThreads = useCallback(async () => { if (live) setThreads(await fetchDirectThreads()); }, [live]);
  const refreshAll = useCallback(async () => {
    if (!live) return;
    try { await Promise.all([loadGroups(), loadThreads()]); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Messages couldn’t load."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [live, loadGroups, loadThreads]);
  const loadConversation = useCallback(async () => {
    try {
      if (mode === "Groups") setGroupMessages(activeGroupId ? await fetchGroupMessages(activeGroupId) : []);
      else { setDirectMessages(activeDirectId ? await fetchDirectMessages(activeDirectId) : []); if (activeDirectId) await loadThreads(); }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "This conversation couldn’t load."); }
  }, [mode, activeGroupId, activeDirectId, loadThreads]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);
  useEffect(() => { void loadConversation(); }, [loadConversation]);
  useEffect(() => {
    const refresh = () => { void refreshAll(); void loadConversation(); };
    const offGroups = subscribeCampusMessages(campus, refresh), offSocial = subscribeCampusSocial(refresh);
    return () => { offGroups(); offSocial(); };
  }, [campus, refreshAll, loadConversation]);
  useEffect(() => {
    if (!directPeer || !live) return;
    let mounted = true;
    setMode("Direct"); setPendingPeerName(directPeer.name);
    void openDirectConversation(campus, directPeer.id).then(async (id) => {
      if (!mounted) return;
      setActiveDirectId(id); await loadThreads(); directOpened?.();
    }).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t start the conversation."));
    return () => { mounted = false; };
  }, [directPeer, live, campus, loadThreads, directOpened]);
  useEffect(() => { if ((mode === "Groups" ? groupMessages : directMessages).length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 40); }, [mode, groupMessages, directMessages]);

  async function send() {
    const target = mode === "Groups" ? activeGroupId : activeDirectId;
    if (!target || !body.trim() || busy) return;
    const text = body.trim(); setBody(""); setBusy(true);
    try { if (mode === "Groups") await sendGroupMessage(target, randomUUID(), author, text); else await sendDirectMessage(target, randomUUID(), text); await loadConversation(); }
    catch (e) { setBody(text); setError(e instanceof Error ? e.message : "Message couldn’t be sent."); }
    finally { setBusy(false); }
  }
  async function create() {
    if (busy) return; setBusy(true);
    try { const id = await createCampusGroup(campus, groupName, description); setCreating(false); setGroupName(""); setDescription(""); await loadGroups(); setActiveGroupId(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Group couldn’t be created."); }
    finally { setBusy(false); }
  }

  if (!live) return <View style={s.center}><Ionicons name="chatbubbles-outline" size={38} color={t.active} /><Text style={s.title}>{accountId ? "Choose your university" : "Sign in for messages"}</Text><Text style={s.caption}>Private chats and group conversations stay inside your university.</Text><Touch accessibilityRole="button" onPress={profile} style={s.primary}><Text style={s.primaryText}>{accountId ? "Open profile" : "View account"}</Text></Touch></View>;

  const messages = mode === "Groups" ? groupMessages : directMessages;
  const hasConversation = mode === "Groups" ? !!activeGroup : !!activeDirectId;
  const unread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <View style={s.header}><View style={{ flex: 1 }}><Text style={s.heading}>Messages</Text><Text style={s.caption}>{campus}</Text></View>{mode === "Groups" && <Touch accessibilityRole="button" accessibilityLabel="Create group chat" onPress={() => setCreating(true)} style={s.iconButton}><Ionicons name="add" size={25} color={t.text} /></Touch>}</View>
    <View accessibilityRole="tablist" style={s.modeTabs}>{(["Direct", "Groups"] as const).map((value) => <Touch key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setBody(""); }} style={[s.modeTab, mode === value && s.modeTabActive]}><Ionicons name={value === "Direct" ? "person-outline" : "people-outline"} size={17} color={mode === value ? t.text : t.muted} /><Text style={[s.modeText, mode === value && { color: t.text }]}>{value}</Text>{value === "Direct" && unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread}</Text></View>}</Touch>)}</View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {loading ? <ActivityIndicator color={t.active} style={{ marginTop: 40 }} /> : mode === "Direct" && !activeDirectId ? <ThreadList threads={threads} refreshing={refreshing} refresh={() => { setRefreshing(true); void refreshAll(); }} open={(thread) => { setActiveDirectId(thread.id); setPendingPeerName(thread.peerName); }} /> : <>
      {mode === "Groups" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupTabs}>{groups.filter((x) => x.joined).map((group) => <Touch key={group.id} accessibilityRole="tab" accessibilityState={{ selected: activeGroupId === group.id }} onPress={() => setActiveGroupId(group.id)} style={[s.groupTab, activeGroupId === group.id && s.groupTabActive]}><Text style={[s.groupTabText, activeGroupId === group.id && { color: t.text }]}>{group.name}</Text></Touch>)}</ScrollView> : <View style={s.conversationHead}><Touch accessibilityRole="button" accessibilityLabel="Back to conversations" onPress={() => { setActiveDirectId(""); setPendingPeerName(""); }} style={s.back}><Ionicons name="chevron-back" size={23} color={t.text} /></Touch><Avatar name={activeName} small /><View style={{ flex: 1 }}><Text style={s.title}>{activeName || "Campus student"}</Text><Text style={s.caption}>Private campus conversation</Text></View></View>}
      {mode === "Groups" && activeGroup && <View style={s.conversationHead}><Avatar name={activeGroup.name} small /><View style={{ flex: 1 }}><Text style={s.title}>{activeGroup.name}</Text><Text numberOfLines={1} style={s.caption}>{activeGroup.description || "Campus group chat"}</Text></View></View>}
      <ScrollView ref={scroll} style={s.messages} contentContainerStyle={s.messageContent} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refreshAll().then(loadConversation); }} tintColor={t.active} colors={[t.active]} />}>
        {!messages.length && hasConversation && <View style={s.empty}><Text style={s.title}>Start the conversation</Text><Text style={s.caption}>Be friendly, clear, and mindful of personal information.</Text></View>}
        {messages.map((message) => <View key={message.id} style={[s.bubbleRow, message.mine && { justifyContent: "flex-end" }]}><View style={[s.bubble, message.mine && s.mine]}>{!message.mine && mode === "Groups" && <Text style={s.sender}>{"senderName" in message ? message.senderName : activeName}</Text>}<Text style={s.messageText}>{message.body}</Text><Text style={s.time}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View></View>)}
        {mode === "Groups" && <Discover groups={groups} join={(id) => { void joinCampusGroup(id).then(loadGroups).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t join group.")); }} />}
      </ScrollView>
      {hasConversation && <View style={s.composer}><Input accessibilityLabel={`Message ${mode === "Groups" ? activeGroup?.name : activeName}`} value={body} onChangeText={setBody} placeholder="Write a message…" placeholderTextColor={t.muted} maxLength={2000} multiline style={s.input} /><Touch accessibilityRole="button" accessibilityLabel="Send message" disabled={!body.trim() || busy} onPress={() => { void send(); }} style={[s.send, (!body.trim() || busy) && { opacity: 0.4 }]}><Ionicons name="arrow-up" size={22} color={t.text} /></Touch></View>}
    </>}
    <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}><ModalSafeArea style={s.modal}><View style={s.modalHeader}><Touch accessibilityRole="button" accessibilityLabel="Close new group" onPress={() => setCreating(false)} style={s.iconButton}><Ionicons name="close" size={25} color={t.text} /></Touch><Text style={s.title}>New group chat</Text><Touch accessibilityRole="button" disabled={!groupName.trim() || busy} onPress={() => { void create(); }} style={s.iconButton}><Text style={[s.joinText, (!groupName.trim() || busy) && { opacity: 0.4 }]}>Create</Text></Touch></View><View style={s.form}><Text style={s.caption}>Groups are visible to everyone at {campus}. Students choose whether to join.</Text><Input accessibilityLabel="Group name" value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={t.muted} maxLength={100} style={s.formInput} /><Input accessibilityLabel="Group description" value={description} onChangeText={setDescription} placeholder="What is this group for?" placeholderTextColor={t.muted} maxLength={500} multiline style={[s.formInput, { minHeight: 120 }]} /></View></ModalSafeArea></Modal>
  </KeyboardAvoidingView>;
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) { return <View style={small ? s.smallAvatar : s.avatar}><Text style={s.avatarText}>{name[0]?.toUpperCase() || "?"}</Text></View>; }
function ThreadList({ threads, refreshing, refresh, open }: { threads: DirectThread[]; refreshing: boolean; refresh: () => void; open: (thread: DirectThread) => void }) {
  return <ScrollView contentContainerStyle={s.threadList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.active} colors={[t.active]} />}>{!threads.length && <View style={s.empty}><Ionicons name="paper-plane-outline" size={31} color={t.active} /><Text style={s.title}>No private conversations yet</Text><Text style={s.caption}>Use “Message seller” on a Marketplace post to start one.</Text></View>}{threads.map((thread) => <Touch key={thread.id} accessibilityRole="button" accessibilityLabel={`Open conversation with ${thread.peerName}`} onPress={() => open(thread)} style={s.thread}><Avatar name={thread.peerName} /><View style={{ flex: 1, gap: 4 }}><Text style={s.title}>{thread.peerName}</Text><Text numberOfLines={1} style={s.caption}>{thread.lastMessage || thread.peerMajor || "Start a conversation"}</Text></View><View style={{ alignItems: "flex-end", gap: 7 }}><Text style={s.time}>{new Date(thread.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>{thread.unread > 0 && <View style={s.unread} />}</View></Touch>)}</ScrollView>;
}
function Discover({ groups, join }: { groups: CampusGroup[]; join: (id: string) => void }) { const available = groups.filter((x) => !x.joined); return available.length ? <View style={s.discover}><Text style={s.section}>Discover campus groups</Text>{available.map((group) => <View key={group.id} style={s.discoverRow}><View style={{ flex: 1, gap: 3 }}><Text style={s.title}>{group.name}</Text><Text style={s.caption}>{group.description || "Campus group chat"}</Text></View><Touch accessibilityRole="button" onPress={() => join(group.id)} style={s.join}><Text style={s.joinText}>Join</Text></Touch></View>)}</View> : null; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background }, header: { minHeight: 68, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: t.line },
  heading: { color: t.text, fontSize: 25, fontWeight: "600", letterSpacing: -0.7 }, title: { color: t.text, fontSize: 15, fontWeight: "600", lineHeight: 21 }, caption: { color: t.muted, fontSize: 12, lineHeight: 18 }, iconButton: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  modeTabs: { flexDirection: "row", paddingHorizontal: 18, borderBottomWidth: 1, borderColor: t.line }, modeTab: { flex: 1, minHeight: 48, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" }, modeTabActive: { borderBottomColor: t.active }, modeText: { color: t.muted, fontSize: 13 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: t.active, alignItems: "center", justifyContent: "center" }, badgeText: { color: t.background, fontSize: 10, fontWeight: "700" },
  groupTabs: { minHeight: 46, paddingHorizontal: 18, gap: 20, borderBottomWidth: 1, borderColor: t.line }, groupTab: { justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" }, groupTabActive: { borderBottomColor: t.active }, groupTabText: { color: t.muted, fontSize: 13 },
  conversationHead: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }, back: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.raised, alignItems: "center", justifyContent: "center" }, smallAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.raised, alignItems: "center", justifyContent: "center" }, avatarText: { color: t.active, fontSize: 16, fontWeight: "600" },
  threadList: { paddingHorizontal: 18, flexGrow: 1 }, thread: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderColor: t.line }, unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.active }, messages: { flex: 1 }, messageContent: { padding: 18, gap: 9, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" }, bubble: { maxWidth: "82%", backgroundColor: t.surface, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 9, gap: 3 }, mine: { backgroundColor: t.teal, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 }, sender: { color: t.active, fontSize: 11, fontWeight: "600" }, messageText: { color: t.text, fontSize: 14, lineHeight: 20 }, time: { color: t.muted, fontSize: 9, alignSelf: "flex-end" },
  empty: { alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 52, paddingHorizontal: 24 }, discover: { marginTop: 24, borderTopWidth: 1, borderColor: t.line }, section: { color: t.muted, fontSize: 11, paddingVertical: 15, textTransform: "uppercase", letterSpacing: 1.2 }, discoverRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: 1, borderColor: t.line },
  join: { minWidth: 60, minHeight: 40, borderRadius: 20, backgroundColor: t.raised, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }, joinText: { color: t.active, fontSize: 13, fontWeight: "600" }, composer: { flexDirection: "row", gap: 10, alignItems: "flex-end", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: t.line }, input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: t.surface, borderRadius: 23, paddingHorizontal: 16, paddingVertical: 11, color: t.text }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.teal, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: t.background }, primary: { marginTop: 8, minHeight: 46, borderRadius: 23, backgroundColor: t.teal, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }, primaryText: { color: t.text, fontSize: 14, fontWeight: "600" }, error: { color: "#e8ad9f", fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: t.background }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: t.line, paddingHorizontal: 10 }, form: { padding: 22, gap: 18 }, formInput: { color: t.text, fontSize: 16, backgroundColor: t.surface, borderRadius: 10, padding: 14 },
});
