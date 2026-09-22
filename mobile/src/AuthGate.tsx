import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";
import { emptyProfile, validProfile, type StudentProfile } from "../../src/studentProfile";
import { auth } from "./authClient";
import Input from "./FocusInput";
import Touch from "./Touch";
import StepMotion from "./StepMotion";
import Onboarding, { s } from "./Onboarding";
import { theme as t } from "./theme";

export type AccountControls = { accountId?: string; profile: StudentProfile; editPreferences: () => void; signOut: () => void; security: () => void };
const profileKey = (id: string) => `orbit-profile-${id}`;
const lockKey = (id: string) => `orbit-lock-${id}`;
const confirmationUrl = Linking.createURL("auth/confirmed");
export default function AuthGate({ children }: { children: (controls: AccountControls) => React.ReactNode }) {
  const incomingUrl = Linking.useURL();
  const [session,setSession] = useState<Session|null>(null), [guest,setGuest] = useState(false), [loading,setLoading] = useState(true);
  const [profile,setProfile] = useState<StudentProfile|null>(null), [editing,setEditing] = useState(false), [locked,setLocked] = useState(true), [lockEnabled,setLockEnabled] = useState(false);
  const [security,setSecurity] = useState(false), [biometric,setBiometric] = useState(""), [email,setEmail] = useState(""), [password,setPassword] = useState(""), [authMode,setAuthMode] = useState<"signin"|"signup">("signin"), [confirmation,setConfirmation] = useState(false), [confirmed,setConfirmed] = useState(false), [notice,setNotice] = useState(""), [error,setError] = useState(""), [busy,setBusy] = useState(false), [cooldown,setCooldown] = useState(0), [retry,setRetry] = useState(0);
  const prompting = useRef(false), operation = useRef(false), generation = useRef(0);
  const currentId = useRef<string|null>(null);
  const credentialEntry = useRef(false);
  const id = session?.user.id ?? "preview";
  useEffect(()=>{
    if(!cooldown)return;
    const timer=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);
    return ()=>clearTimeout(timer);
  },[cooldown]);
  useEffect(()=>{
    if(!incomingUrl?.includes("auth/confirmed"))return;
    setConfirmation(false);setConfirmed(true);setAuthMode("signin");setError("");setNotice("Your email is verified. Sign in to enter Orbit.");
  },[incomingUrl]);
  useEffect(() => {
    if (Platform.OS === "web" || (Platform.OS === "ios" && Constants.appOwnership === "expo")) return;
    Promise.all([LocalAuthentication.hasHardwareAsync(),LocalAuthentication.isEnrolledAsync(),LocalAuthentication.supportedAuthenticationTypesAsync()])
      .then(([hardware,enrolled,types])=>{if(hardware&&enrolled)setBiometric(Platform.OS==="ios"&&types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)?"Face ID":Platform.OS==="ios"?"Touch ID":"biometrics");}).catch(()=>{});
  },[]);
  useEffect(() => {
    let alive = true;
    async function accept(next: Session|null, credentialReentry = false) {
      if (!alive) return;
      if (next && next.user.id === currentId.current) { setSession(next); return; }
      const version = ++generation.current;
      currentId.current = next?.user.id ?? null;
      setLoading(true); setLocked(true); setProfile(null); setSession(next); setGuest(false); setError(""); setSecurity(false);
      try {
        if(next){
          const [raw,preference] = await Promise.all([AsyncStorage.getItem(profileKey(next.user.id)),Platform.OS==="web"?Promise.resolve(null):SecureStore.getItemAsync(lockKey(next.user.id))]);
          const p = raw ? JSON.parse(raw) : emptyProfile();
          if(!validProfile(p))throw Error("Your preferences could not be read. Please try again.");
          if(!alive || version!==generation.current)return;
          setProfile(p);setLockEnabled(preference==="enabled");setLocked(preference==="enabled" && !credentialReentry);
        }else{setLockEnabled(false);setLocked(false);}
      }catch(e){if(alive && version===generation.current){setError(e instanceof Error?e.message:"Couldn’t restore your session.");setLocked(false);}}
      finally{if(alive && version===generation.current)setLoading(false);}
    }
    if(!auth){setLoading(false);setLocked(false);return;}
    void auth.auth.getSession().then(({data,error})=>{if(error)throw error;return accept(data.session);}).catch(()=>{if(alive){setError("Couldn’t restore sign-in. Try again.");setLoading(false);}});
    const {data:{subscription}}=auth.auth.onAuthStateChange((event,next)=>{void accept(next,event === "SIGNED_IN" && credentialEntry.current);});
    return ()=>{alive=false;subscription.unsubscribe();currentId.current=null;};
  },[retry]);
  useEffect(()=>{
    const sub=AppState.addEventListener("change",state=>{
      if(state!=="active"){
        auth?.auth.stopAutoRefresh();
        if(lockEnabled&&!prompting.current)setLocked(true);
      }else auth?.auth.startAutoRefresh();
    });
    return ()=>sub.remove();
  },[lockEnabled]);
  async function run(fn:()=>Promise<void>){if(operation.current)return;operation.current=true;setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Something went wrong. Try again.");}finally{operation.current=false;setBusy(false);}}
  async function preview(){await run(async()=>{const raw=await AsyncStorage.getItem(profileKey("preview"));const p=raw?JSON.parse(raw):emptyProfile();if(!validProfile(p))throw Error("Preview preferences could not be read.");setProfile(p);setGuest(true);setLocked(false);});}
  async function submitAuth(){await run(async()=>{
    if(!auth)throw Error("Email sign-in is not connected yet. You can explore the preview below.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error("Enter a valid email address.");
    if(password.length<8)throw Error("Use at least 8 characters for your password.");
    credentialEntry.current=true;
    try {
      if(authMode==="signup"){
        const {data,error}=await auth.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:confirmationUrl}});
        if(error)throw error;
        setPassword("");
        if(!data.session){setConfirmation(true);setCooldown(60);setNotice("Confirmation email sent. Check your inbox and spam folder.");}
      }else{
        const {error}=await auth.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
        if(error)throw error;
        setPassword("");
      }
    } finally { credentialEntry.current=false; }
  });}
  async function resendConfirmation(){await run(async()=>{
    if(!auth)throw Error("Email sign-in is not connected yet.");
    const {error}=await auth.auth.resend({type:"signup",email:email.trim().toLowerCase(),options:{emailRedirectTo:confirmationUrl}});
    if(error)throw error;
    setCooldown(60);setNotice("A new confirmation email was sent.");
  });}
  async function signOut(){await run(async()=>{
    if(session&&auth){const {error}=await auth.auth.signOut({scope:"local"});if(error)throw error;if(Platform.OS!=="web")await SecureStore.deleteItemAsync(lockKey(session.user.id));}
    setGuest(false);setProfile(null);setSession(null);setEditing(false);setSecurity(false);setLocked(false);setLockEnabled(false);setConfirmation(false);setConfirmed(false);setPassword("");setNotice("");
  });}
  async function unlock(enable=false){await run(async()=>{
    if(!biometric)throw Error("Biometric unlock is unavailable here. Sign in with email instead.");
    prompting.current=true;
    try{const result=await LocalAuthentication.authenticateAsync({promptMessage:`Unlock Orbit with ${biometric}`,cancelLabel:"Cancel",disableDeviceFallback:true,biometricsSecurityLevel:"strong"});
      if(!result.success)throw Error("Orbit is still locked. Try again or sign in with email.");
      if(enable){await SecureStore.setItemAsync(lockKey(id),"enabled");setLockEnabled(true);}
      setLocked(false);setSecurity(false);
    }finally{prompting.current=false;}
  });}
  async function saveProfile(p:StudentProfile){await AsyncStorage.setItem(profileKey(id),JSON.stringify(p));}
  const button=(label:string,onPress:()=>void,secondary=false,disabled=false)=><Touch disabled={busy||disabled} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[s.primary,{marginTop:14,opacity:busy||disabled?0.5:1},secondary&&{backgroundColor:t.background,borderWidth:1,borderColor:t.line}]}><Text style={[s.primaryText,secondary&&{color:t.text}]}>{label}</Text><Ionicons accessible={false} name="arrow-forward" color={secondary?t.active:t.onCream} size={19}/></Touch>;
  if(loading)return <SafeAreaView style={[s.safe,{justifyContent:"center",alignItems:"center"}]}><ActivityIndicator color={t.active}/><Text style={s.hint}>Opening your Orbit…</Text></SafeAreaView>;
  if((session||guest)&&profile&&!locked&&!security){
    if(!profile.completed||editing)return <Onboarding key={id} initial={profile} preview={guest} save={saveProfile} finish={p=>{setProfile(p);setEditing(false);if(session&&!profile.completed&&Platform.OS!=="web")setSecurity(true);}} cancel={()=>{if(profile.completed)setEditing(false);else void signOut();}}/>;
    return <>{children({accountId:session?.user.id,profile,editPreferences:()=>setEditing(true),signOut:()=>{setSecurity(true);},security:()=>setSecurity(true)})}</>;
  }
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}><StepMotion step={locked?"locked":security?"security":confirmation?"confirmation":confirmed?"confirmed":authMode}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{flexGrow:1}]}>
    <Text style={[s.brand,{marginBottom:42}]}>orbit.</Text>
    <View style={{height:130,justifyContent:"center",alignItems:"center",marginBottom:25}}><View style={{width:190,height:90,borderWidth:1,borderColor:t.teal,borderRadius:100,transform:[{rotate:"-20deg"}],alignItems:"center",justifyContent:"center"}}><View style={{width:68,height:68,borderRadius:34,backgroundColor:t.teal,alignItems:"center",justifyContent:"center"}}><Ionicons name={locked||security?"scan-outline":"planet-outline"} color={t.cream} size={34}/></View></View></View>
    <Text style={s.overline}>{locked?"YOUR SPACE, PROTECTED":security?"YOUR ACCOUNT":confirmed?"YOU’RE IN":"CAMPUS LIFE, WITH YOUR PEOPLE"}</Text>
    <Text accessibilityRole="header" style={s.title}>{locked?"Welcome back.":security?"An easier way in.":confirmation?"Check your inbox.":confirmed?"Email confirmed.":authMode==="signup"?"Create your Orbit.":"Find your people.\nMake your plans."}</Text>
    <Text style={s.body}>{locked?"Unlock your signed-in session to continue.":security?"Use your device’s biometric check when you return to Orbit.":confirmation?`Confirm ${email}, then come back and sign in.`:confirmed?"Your Orbit account is ready. Sign in below to continue.":authMode==="signup"?"Start with an account, then shape Orbit around your campus life.":"A place for life between classes. Sign in with your email and password."}</Text>
    {!!error&&<Text accessibilityRole="alert" style={[s.error,{marginTop:18}]}>{error}</Text>}
    {!!notice&&<Text accessibilityRole="alert" style={[s.hint,{marginTop:18,color:t.active}]}>{notice}</Text>}
    {(locked||security)?<>
      {!!biometric&&session&&button(lockEnabled&&!locked?`Disable ${biometric}`:`${locked?"Unlock":"Enable"} ${biometric}`,()=>{if(lockEnabled&&!locked)void run(async()=>{await SecureStore.deleteItemAsync(lockKey(id));setLockEnabled(false);});else void unlock(!locked);})}
      {!biometric&&<Text style={s.hint}>{Platform.OS==="ios"&&Constants.appOwnership==="expo"?"Face ID is available in an installed Orbit development build, not Expo Go.":"Biometric unlock needs a supported device with Face ID or a fingerprint enrolled."}</Text>}
      {!session&&<Text style={s.hint}>Preview mode has no signed-in session. Sign in with email before enabling biometric unlock.</Text>}
      {!locked&&button("Continue to Orbit",()=>setSecurity(false),true)}
      {button(guest?"Leave preview":"Sign out and use email",()=>void signOut(),true)}
    </>:session&&!profile?<>{button("Retry loading account",()=>setRetry(x=>x+1))}{button("Sign out",()=>void signOut(),true)}</>:confirmation?<>
      {button("I’ve confirmed my email",()=>{setConfirmation(false);setAuthMode("signin");setError("");})}
      {button(cooldown?`Resend available in ${cooldown}s`:"Resend confirmation email",()=>void resendConfirmation(),true,!!cooldown)}
      {button("Use a different email",()=>{setConfirmation(false);setEmail("");setError("");},true)}
    </>:<>
      <Text style={[s.label,{marginTop:28}]}>Email address</Text>
      <Input accessibilityLabel="Email address" value={email} onChangeText={value=>{setEmail(value);setError("");}} placeholder="you@university.edu" placeholderTextColor={t.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" maxLength={254} style={s.input}/>
      <Text style={[s.label,{marginTop:16}]}>Password</Text>
      <Input accessibilityLabel="Password" value={password} onChangeText={value=>{setPassword(value);setError("");}} placeholder="8 or more characters" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType={authMode==="signup"?"newPassword":"password"} style={s.input}/>
      {button(busy?"Please wait…":authMode==="signup"?"Create account":"Sign in",()=>void submitAuth(),false,!auth)}
      {button(authMode==="signup"?"Already have an account? Sign in":"New to Orbit? Create an account",()=>{setAuthMode(mode=>mode==="signup"?"signin":"signup");setConfirmed(false);setPassword("");setError("");},true)}
      {!auth&&<Text style={s.hint}>Email login is awaiting the backend connection. No account is created in preview mode.</Text>}
      {button("Explore the preview",()=>void preview(),true)}
      <Text style={s.hint}>Email verification confirms your inbox—not university enrollment.</Text>
    </>}
  </ScrollView></StepMotion></KeyboardAvoidingView></SafeAreaView>;
}
