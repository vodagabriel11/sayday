import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  subscriptionPlan: "free" | "pro";
  subscriptionExpiry: string | null;
  weeklyTaskCount: number;
  notifReminders: boolean;
  notifDailySummary: boolean;
  notifEventAlerts: boolean;
  defaultReminderMinutes: number;
  accentColor: string;
  fontSize: string;
  createdAt: string;
};

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      localStorage.setItem("onboarding_seen", "1");
      localStorage.setItem("plan_selected", "1");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      localStorage.removeItem("plan_selected");
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
