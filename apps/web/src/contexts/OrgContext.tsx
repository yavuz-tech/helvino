"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface Organization {
  id: string;
  key: string;
  name: string;
  siteId: string;
  allowLocalhost: boolean;
  allowedDomains: string[];
  createdAt: string;
  updatedAt: string;
}

interface OrgContextType {
  organizations: Organization[];
  selectedOrg: Organization | null;
  isLoading: boolean;
  error: string | null;
  selectOrg: (orgKey: string) => void;
  refreshOrgs: () => Promise<void>;
  createOrg: (data: { name: string; allowedDomains?: string[]; allowLocalhost?: boolean }) => Promise<Organization>;
}

const OrgContext = createContext<OrgContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ORG_KEY_STORAGE = "helvino_admin_org_key";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all organizations
  const fetchOrgs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/internal/orgs`, {
        credentials: "include", // Send session cookie
      });

      if (!response.ok) {
        // 401/403 is expected on non-admin pages (portal, public)
        // Silently return empty list instead of throwing
        if (response.status === 401 || response.status === 403) {
          setOrganizations([]);
          setSelectedOrg(null);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const orgs: Organization[] = await response.json();
      setOrganizations(orgs);

      // Select org: try stored key, else first org, else null
      if (orgs.length > 0) {
        const storedKey = localStorage.getItem(ORG_KEY_STORAGE);
        const orgToSelect = storedKey
          ? orgs.find(o => o.key === storedKey) || orgs[0]
          : orgs[0];
        
        setSelectedOrg(orgToSelect);
        localStorage.setItem(ORG_KEY_STORAGE, orgToSelect.key);
      } else {
        setSelectedOrg(null);
        localStorage.removeItem(ORG_KEY_STORAGE);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
      setError("Failed to load organizations");
      setOrganizations([]);
      setSelectedOrg(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load organizations on mount
  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Select organization
  const selectOrg = useCallback((orgKey: string) => {
    const org = organizations.find(o => o.key === orgKey);
    if (org) {
      setSelectedOrg(org);
      localStorage.setItem(ORG_KEY_STORAGE, org.key);
    }
  }, [organizations]);

  // Refresh organizations
  const refreshOrgs = useCallback(async () => {
    await fetchOrgs();
  }, [fetchOrgs]);

  // Create new organization
  const createOrg = useCallback(async (data: {
    name: string;
    allowedDomains?: string[];
    allowLocalhost?: boolean;
  }): Promise<Organization> => {
    const response = await fetch(`${API_URL}/internal/orgs`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const newOrg: Organization = await response.json();

    // Refresh org list and select the new org
    await refreshOrgs();
    selectOrg(newOrg.key);

    return newOrg;
  }, [refreshOrgs, selectOrg]);

  return (
    <OrgContext.Provider
      value={{
        organizations,
        selectedOrg,
        isLoading,
        error,
        selectOrg,
        refreshOrgs,
        createOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return context;
}
