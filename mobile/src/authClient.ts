import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Browser sessions are tab-scoped. Native sessions use the device's encrypted storage.
const storage = {
  getItem: async (name: string) => Platform.OS === "web" ? sessionStorage.getItem(name) : SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) => {
    if (Platform.OS === "web") sessionStorage.setItem(name,value);
    else await SecureStore.setItemAsync(name,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  },
  removeItem: async (name: string) => {
    if (Platform.OS === "web") sessionStorage.removeItem(name);
    else await SecureStore.deleteItemAsync(name);
  },
};
export const auth = url && key ? createClient(url,key,{auth:{storage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}}) : null;
