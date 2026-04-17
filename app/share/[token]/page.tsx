"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Layout, Typography, Tag, Timeline, Spin, Tabs } from "antd";
import { toTransportKey, VEHICLE_ICON } from "@/lib/transport";
import { getCountryFlags } from "@/lib/countries";
import PhotoWall from "@/app/components/PhotoWall";

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
}

interface Segment {
  id: string;
  order: number;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
  date: string;
  time: string;
  flight_no: string;
  aircraft: string;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setTrip(data.trip);
          setSegments(data.segments);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <Typography.Text className="text-zinc-500 text-base">找不到這筆旅程</Typography.Text>
        <Typography.Text className="text-zinc-700 text-[13px]">連結可能已失效</Typography.Text>
      </div>
    );
  }

  const duration =
    trip.start_date && trip.end_date
      ? Math.round(
          (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  const countries = trip.countries
    ? trip.countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];

  const flags = getCountryFlags(trip.countries ?? "");

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: (
      <div className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-4 py-[14px] mb-1">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[22px] shrink-0 leading-none">{VEHICLE_ICON[toTransportKey(seg.type)]}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col items-start">
              <Typography.Text strong className="text-zinc-100 text-[15px] leading-[1.3]">{seg.from_city}</Typography.Text>
              {seg.from_iata && <span className="text-zinc-600 text-[11px] tracking-[0.05em]">{seg.from_iata}</span>}
            </div>
            <span className="text-zinc-700 text-base">→</span>
            <div className="flex flex-col items-start">
              <Typography.Text strong className="text-zinc-100 text-[15px] leading-[1.3]">{seg.to_city}</Typography.Text>
              {seg.to_iata && <span className="text-zinc-600 text-[11px] tracking-[0.05em]">{seg.to_iata}</span>}
            </div>
          </div>
        </div>
        <div className="pl-8 flex gap-1.5 flex-wrap">
          {seg.date && (
            <Tag color="geekblue" className="rounded-md">
              {seg.date}{seg.time && <span className="opacity-75"> {seg.time}</span>}
            </Tag>
          )}
          {seg.flight_no && <Tag color="purple" className="rounded-md">{seg.flight_no}</Tag>}
          {seg.aircraft && <Tag color="cyan" className="rounded-md">{seg.aircraft}</Tag>}
        </div>
      </div>
    ),
  }));

  return (
    <Layout className="min-h-screen bg-[#09090b]">
      <Layout.Header className="flex items-center justify-between border-b border-[#27272a] px-5 bg-[rgba(9,9,11,0.85)] backdrop-blur-xl sticky top-0 z-[100]">
        <Typography.Text className="text-zinc-100 text-base font-semibold">
          ✈️ Travel Tracker
        </Typography.Text>
        <Tag color="blue" className="!rounded-full !m-0">共享旅程</Tag>
      </Layout.Header>

      <Layout.Content className="max-w-[720px] mx-auto py-8 px-6 pb-20 w-full">
        <div className="bg-gradient-to-br from-[#18181b] to-[#1c1c1e] border border-[#27272a] rounded-2xl px-7 pt-7 pb-6 mb-7">
          {flags && <div className="text-[28px] mb-2.5 tracking-widest">{flags}</div>}
          <Typography.Title level={2} className="!text-zinc-100 !m-0 !mb-4 !leading-[1.25]">
            {trip.name}
          </Typography.Title>
          <div className="flex flex-wrap gap-2 items-center">
            {trip.start_date && trip.end_date && (
              <span className="bg-blue-500/10 border border-blue-500/25 text-blue-300 rounded-full px-3 py-[3px] text-[13px]">
                {trip.start_date} → {trip.end_date}
              </span>
            )}
            {duration !== null && (
              <span className="bg-indigo-400/10 border border-indigo-400/25 text-indigo-300 rounded-full px-3 py-[3px] text-[13px]">
                {duration} 天
              </span>
            )}
            {countries.map((c) => (
              <Tag key={c} color="blue" className="!rounded-full !m-0 !text-[13px] !px-2.5 !py-[2px]">{c}</Tag>
            ))}
          </div>
          {trip.notes && (
            <Typography.Text className="text-zinc-500 text-[13px] mt-3.5 block whitespace-pre-wrap">
              {trip.notes}
            </Typography.Text>
          )}
        </div>

        <Tabs
          items={[
            ...(segments.length > 0 ? [{
              key: "transport",
              label: "✈️ 交通",
              children: <Timeline items={timelineItems} />,
            }] : []),
            ...(trip.photo_album_id ? [{
              key: "photos",
              label: "📷 照片",
              children: <PhotoWall albumUrl={trip.photo_album_id} />,
            }] : []),
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
