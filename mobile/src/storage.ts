import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalStore } from "../../src/localStore";
const store = createLocalStore(AsyncStorage);
export const persist = store.save;
export const restore = store.load;
export const persistDrafts = store.saveDrafts;
