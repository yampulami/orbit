import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { lifestyles, years, hobbies, clubInterests, profileSuggestions, toggleInterest, type StudentProfile } from "../../src/studentProfile";
import Input from "./FocusInput";
import Touch from "./Touch";
import StepMotion from "./StepMotion";
import { theme as t } from "./theme";

export default function Onboarding({ initial, save, finish, cancel, preview }: {
  initial: StudentProfile; save: (p: StudentProfile) => Promise<void>; finish: (p: StudentProfile) => void; cancel: () => void; preview: boolean;
}) {
  const [profile,setProfile] = useState(initial), [step,setStep] = useState(0), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const submitting = useRef(false);
  const scroll = useRef<ScrollView>(null);
  function patch(update: Partial<StudentProfile>) { setProfile(p => ({...p,...update})); setError(""); }
  async function next() {
    if (submitting.current) return;
    if (step === 0 && !profile.name.trim()) { setError("What should we call you?"); return; }
    submitting.current = true; setBusy(true); setError("");
    const nextProfile = {...profile, name:profile.name.trim(), campus:profile.campus.trim(), major:profile.major.trim(), completed:step === 3};
    try { await save(nextProfile); if (step === 3) finish(nextProfile); else { setStep(step+1); scroll.current?.scrollTo({y:0,animated:false}); } }
    catch { setError("Couldn’t save your setup. Your answers are still here—try again."); }
    finally { setBusy(false); submitting.current = false; }
  }
  const choice = (label:string, selected:boolean, onPress:()=>void, multiple=false) => <Touch key={label} accessibilityRole={multiple ? "checkbox" : "radio"} accessibilityLabel={label} accessibilityState={{checked:selected}} onPress={onPress} style={[s.choice, selected && s.selected]}><Text style={[s.choiceText,selected && {color:t.text}]}>{label}</Text><Ionicons accessible={false} name={selected?"checkmark":"add"} size={16} color={selected?t.active:t.muted}/></Touch>;
  const field = (label:string, value:string, onChange:(x:string)=>void, placeholder:string) => <View style={{gap:8,marginTop:22}}><Text style={s.label}>{label}</Text><Input accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={100} placeholder={placeholder} placeholderTextColor={t.muted} style={s.input}/></View>;
  const titles = ["Your campus.\nYour kind of life.", "Where are you\nin your journey?", "Find your\ncommon ground.", "A little more you."];
  const subtitles = ["A few details to make Orbit useful from the start.", "Find a place for your studies and everything around them.", "Pick a few, pick a lot. You can change these later.", "Here’s what your answers make room for."];
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}>
    <View style={s.top}><Touch accessibilityRole="button" accessibilityLabel={step?"Previous step":"Leave setup"} onPress={()=>{if(step){setStep(step-1);setError("");}else cancel();}} style={s.icon}><Ionicons name="arrow-back" color={t.text} size={22}/></Touch><Text style={s.brand}>orbit.</Text><Text style={s.label}>{step+1} / 4</Text></View>
    <View accessibilityRole="progressbar" accessibilityValue={{min:1,max:4,now:step+1}} style={s.progress}>{[0,1,2,3].map(i=><View key={i} style={[s.segment,{backgroundColor:i<=step?t.active:t.line}]}/>)}</View>
    <StepMotion step={step}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.overline}>{preview?"PERSONALIZE YOUR PREVIEW":"MAKE ORBIT YOURS"}</Text><Text accessibilityRole="header" style={s.title}>{titles[step]}</Text><Text style={s.body}>{subtitles[step]}</Text>
      {step===0 && <>{field("First name",profile.name,v=>patch({name:v}),"What should we call you?")}{field("College or university (optional)",profile.campus,v=>patch({campus:v}),"Your campus")}
        <Text style={s.section}>How do you get to campus?</Text><View style={s.options}>{lifestyles.map(l=>choice(l,profile.lifestyle===l,()=>patch({lifestyle:profile.lifestyle===l?"":l})))}</View>
        {!!profile.lifestyle && <Text style={s.hint}>{profile.lifestyle==="Commuter"?"We’ll put between-class plans ahead of roommate chores.":"Roommate tools and campus plans, in one place."}</Text>}</>}
      {step===1 && <><Text style={s.section}>Year (optional)</Text><View style={s.options}>{years.map(y=>choice(y,profile.year===y,()=>patch({year:profile.year===y?"":y})))}</View>{field("Major (optional)",profile.major,v=>patch({major:v}),"Computer science, undecided…")}<Text style={s.hint}>Undecided is a perfectly good answer.</Text></>}
      {step===2 && <><Text style={s.section}>Outside the classroom</Text><View style={s.options}>{hobbies.map(h=>choice(h,profile.hobbies.includes(h),()=>patch({hobbies:toggleInterest(profile.hobbies,h)}),true))}</View><Text style={s.section}>Clubs you’d explore</Text><View style={s.options}>{clubInterests.map(c=>choice(c,profile.clubs.includes(c),()=>patch({clubs:toggleInterest(profile.clubs,c)}),true))}</View><Text style={s.hint}>{profile.hobbies.length+profile.clubs.length} interests selected · all optional</Text></>}
      {step===3 && <><View style={s.summary}><Ionicons accessible={false} name="planet-outline" size={42} color={t.cream}/><Text style={s.summaryName}>{profile.name || "Your Orbit"}</Text><Text style={[s.body,{color:t.text}]}>{[profile.campus,profile.year,profile.major,profile.lifestyle].filter(Boolean).join(" · ")}</Text></View>{profileSuggestions(profile).map(item=><View key={item.title} style={s.suggestion}><Text style={s.section}>{item.title}</Text><Text style={s.body}>{item.detail}</Text></View>)}<Text style={s.hint}>Suggestions based on your choices. Campus listings are still samples; this does not enroll you in a club.</Text></>}
    </ScrollView></StepMotion>
    <View style={s.footer}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Touch disabled={busy} accessibilityRole="button" accessibilityLabel={step===3?"Enter Orbit":"Continue"} onPress={()=>void next()} style={[s.primary,busy&&{opacity:0.6}]}><Text style={s.primaryText}>{busy?"Saving…":step===3?"Let’s get into Orbit":"Continue"}</Text><Ionicons name="arrow-forward" color={t.onCream} size={19}/></Touch><Text style={s.privacy}>Preferences stay on this device. Edit them from your profile.</Text></View>
  </KeyboardAvoidingView></SafeAreaView>;
}
export const s = StyleSheet.create({
 safe:{flex:1,backgroundColor:t.background},top:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:22,paddingVertical:10},icon:{minHeight:44,minWidth:44,justifyContent:"center"},brand:{color:t.text,fontSize:24,letterSpacing:-1},label:{color:t.muted,fontSize:12},progress:{flexDirection:"row",gap:6,paddingHorizontal:24},segment:{flex:1,height:2},content:{padding:24,paddingTop:30,maxWidth:600,width:"100%",alignSelf:"center",paddingBottom:30},overline:{fontSize:10,letterSpacing:2,color:t.active,marginBottom:18},title:{fontSize:34,lineHeight:40,letterSpacing:-1.2,color:t.text,marginBottom:14},body:{fontSize:14,lineHeight:22,color:t.muted},input:{borderBottomWidth:1,borderColor:t.line,color:t.text,fontSize:19,paddingVertical:13,minHeight:50},section:{fontSize:16,color:t.text,marginTop:25,marginBottom:12},options:{flexDirection:"row",flexWrap:"wrap",gap:9},choice:{borderWidth:1,borderColor:t.line,paddingHorizontal:14,minHeight:46,borderRadius:12,flexDirection:"row",alignItems:"center",gap:14},selected:{borderColor:t.active,backgroundColor:t.raised},choiceText:{color:t.muted,fontSize:13,flexShrink:1},hint:{fontSize:12,lineHeight:19,color:t.muted,marginTop:16},summary:{backgroundColor:t.teal,padding:22,borderRadius:18,marginTop:24,gap:12},summaryName:{fontSize:26,color:t.text},suggestion:{borderBottomWidth:1,borderColor:t.line,paddingBottom:16},footer:{paddingHorizontal:24,paddingBottom:12,paddingTop:12,borderTopWidth:1,borderColor:t.line,maxWidth:600,width:"100%",alignSelf:"center"},primary:{backgroundColor:t.cream,borderRadius:12,minHeight:52,paddingHorizontal:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},primaryText:{fontSize:15,color:t.onCream,fontWeight:"600"},privacy:{color:t.muted,fontSize:10,lineHeight:16,textAlign:"center",marginTop:10},error:{color:"#e8ad9f",fontSize:13,lineHeight:20,marginBottom:12}
});
