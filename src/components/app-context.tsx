import { createContext, useContext, type ReactNode } from "react";
import { useHouseholdProfiles, useMyProfile, type Profile } from "@/lib/db";
import { useSession } from "@/lib/session";

type AppData = {
  userId: string | undefined;
  me: Profile | null;
  people: Profile[];
  householdId: string | undefined;
  loading: boolean;
};

const AppContext = createContext<AppData>({
  userId: undefined,
  me: null,
  people: [],
  householdId: undefined,
  loading: true,
});

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const meQuery = useMyProfile(userId);
  const me = meQuery.data ?? null;
  const peopleQuery = useHouseholdProfiles(me?.household_id);

  return (
    <AppContext.Provider
      value={{
        userId,
        me,
        people: peopleQuery.data ?? (me ? [me] : []),
        householdId: me?.household_id,
        loading: meQuery.isLoading || peopleQuery.isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export const ACCENTS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  caramel: { bg: "bg-caramel/15", text: "text-caramel", dot: "bg-caramel", label: "Caramel" },
  olive: { bg: "bg-olive/15", text: "text-olive", dot: "bg-olive", label: "Olive" },
  terracotta: { bg: "bg-terracotta/15", text: "text-terracotta", dot: "bg-terracotta", label: "Terracotta" },
  butter: { bg: "bg-butter/40", text: "text-butter-foreground", dot: "bg-butter", label: "Butter" },
};

export function accentOf(profile: { accent?: string } | null | undefined) {
  return ACCENTS[profile?.accent ?? "caramel"] ?? ACCENTS["caramel"]!;
}
