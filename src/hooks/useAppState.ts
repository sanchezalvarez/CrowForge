import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Client, Campaign } from "../types";

const API_BASE = "http://127.0.0.1:8000";

export const useAppState = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/clients`);
      setClients(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch clients", err);
    }
  }, []);

  const fetchCampaigns = useCallback(async (clientId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/campaigns/client/${clientId}`);
      setCampaigns(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    }
  }, []);

  // Selection logic with persistence
  const selectClient = async (client: Client) => {
    setSelectedClient(client);
    setSelectedCampaign(null);
    setCampaigns([]);
    if (client.id) {
      fetchCampaigns(client.id);
      await axios.post(`${API_BASE}/state`, { client_id: client.id, campaign_id: null });
    }
  };

  const selectCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    if (campaign.id) {
      await axios.post(`${API_BASE}/state`, { campaign_id: campaign.id });
    }
  };

  // Initial Load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const allClients = await fetchClients();
      
      try {
        const stateRes = await axios.get(`${API_BASE}/state`);
        const { last_client_id, last_campaign_id } = stateRes.data;
        
        if (last_client_id && allClients) {
          const clientId = parseInt(last_client_id);
          const client = allClients.find((c: Client) => c.id === clientId);
          if (client) {
            setSelectedClient(client);
            const allCampaigns = await fetchCampaigns(clientId);
            
            if (last_campaign_id && allCampaigns) {
              const campId = parseInt(last_campaign_id);
              const campaign = allCampaigns.find((c: Campaign) => c.id === campId);
              if (campaign) setSelectedCampaign(campaign);
            }
          }
        }
      } catch (e) {
        console.warn("No previous state found");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [fetchClients, fetchCampaigns]);

  return {
    clients,
    campaigns,
    selectedClient,
    selectedCampaign,
    isLoading,
    fetchClients,
    fetchCampaigns,
    selectClient,
    selectCampaign,
    setIsLoading
  };
};
