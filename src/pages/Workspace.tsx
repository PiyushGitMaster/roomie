import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowDownUp, Bell, Bookmark, Check, Compass, Heart, Home, LogOut, MessageCircle, Plus, Search, Settings, Shield, Sparkles, UserRound, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { scoreMatch, type MatchProfile } from '../lib/scoring'
import { supabase } from '../lib/supabase'

type Profile = MatchProfile & {
  full_name: string
  age: number | null
  profession: string | null
  bio: string | null
  photo_url: string | null
  move_in_date: string | null
  room_type: string | null
  hide_exact_locality: boolean
  is_visible: boolean
  created_at: string
}
type Message = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null }
type SearchFilters = { city?: string; areas?: string[]; budget_max?: number; smoking?: string; work?: string; cleanliness?: string }
const profileColumns = 'id,full_name,age,profession,city,areas,bio,photo_url,budget_min,budget_max,move_in_date,room_type,lifestyle,hide_exact_locality,is_visible,created_at,updated_at'

const links = [
  { to: '/app', label: 'Overview', icon: Home, end: true },
  { to: '/app/discover', label: 'Discover', icon: Compass },
  { to: '/app/matches', label: 'My matches', icon: Heart },
  { to: '/app/messages', label: 'Messages', icon: MessageCircle },
  { to: '/app/saved', label: 'Saved', icon: Bookmark },
  { to: '/app/profile', label: 'My profile', icon: UserRound },
  { to: '/app/listings', label: 'Listings', icon: Home },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!supabase || !user) return
    const { data, error: queryError } = await supabase.from('profiles').select(profileColumns).eq('id', user.id).maybeSingle()
    if (queryError) { setError(queryError.message); return }
    if (!data) { setProfile(null); return }
    const { data: areas, error: areaError } = await supabase.from('preferred_areas').select('area').eq('user_id', user.id)
    if (areaError) { setError(areaError.message); return }
    setProfile({ ...data, areas: (areas ?? []).map((area) => area.area) } as Profile)
  }, [user])
  useEffect(() => { void Promise.resolve().then(refresh) }, [refresh])
  return { profile, setProfile, refresh, error, setError }
}

export function Workspace() {
  const { user, signOut } = useAuth()
  const { profile, refresh, error, setError } = useProfile()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const displayName = profile?.full_name || user?.user_metadata.full_name || user?.email?.split('@')[0] || 'Roomie'
  useEffect(() => {
    if (!supabase || !user) return
    void supabase.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)))
  }, [user])
  const onSignOut = async () => {
    setSigningOut(true)
    try { await signOut(); navigate('/') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to log out.') } finally { setSigningOut(false) }
  }
  const navigation = isAdmin ? [...links, { to: '/app/admin', label: 'Admin panel', icon: Shield, end: false }] : links
  return <div className="app-layout"><aside className="app-sidebar"><NavLink to="/" className="brand"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></NavLink><div className="sidebar-label">YOUR SPACE</div><nav>{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}><Icon size={17} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><div className="mini-profile"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><div><strong>{displayName}</strong><small>{profile ? 'Member' : 'Set up your profile'}</small></div></div><button className="side-link logout-link" disabled={signingOut} onClick={() => void onSignOut()}><LogOut size={17} />{signingOut ? 'Logging out…' : 'Log out'}</button></div></aside>
    <div className="workspace-main"><header className="workspace-topbar"><div><span className="topbar-greeting">YOUR ROOMIE SPACE</span><span className="topbar-name">Hey, {displayName.split(' ')[0]}</span></div><div className="topbar-actions"><NotificationCenter /><NavLink className="button button-outline button-small" to="/app/profile">{profile ? 'Edit profile' : 'Complete profile'} <ArrowDownUp size={14} /></NavLink></div></header>{error && <div role="alert" className="workspace-error">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}<div className="workspace-content"><Routes><Route index element={<Dashboard profile={profile} />} /><Route path="discover" element={<Discover profile={profile} />} /><Route path="matches" element={<Matches />} /><Route path="messages" element={<Messages />} /><Route path="saved" element={<Saved />} /><Route path="profile" element={<ProfileEditor key={profile?.id ?? 'profile-loading'} profile={profile} onSave={async () => { await refresh() }} setError={setError} />} /><Route path="listings" element={<Listings />} /><Route path="settings" element={<SettingsPage />} /><Route path="admin" element={<AdminPanel />} /></Routes><Outlet /></div><nav className="mobile-nav">{links.slice(0, 5).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={19} /><span>{label}</span></NavLink>)}</nav></div></div>
}

function PageTitle({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-title"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</div>
}

function NotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<{ id: string; kind: string; created_at: string; read_at: string | null }[]>([])
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!supabase || !user) return
    const { data, error } = await supabase.from('notifications').select('id,kind,created_at,read_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
    if (error) setNotice(error.message)
    else setItems(data ?? [])
  }, [user])
  useEffect(() => {
    if (!supabase || !user) return
    void Promise.resolve().then(load)
    const channel = supabase.channel(`notifications-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => void load()).subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [load, user])
  const markRead = async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    if (error) { setNotice(error.message); return }
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
    setOpen(false)
    const item = items.find((notification) => notification.id === id)
    navigate(item?.kind === 'message' ? '/app/messages' : '/app/matches')
  }
  const unread = items.filter((item) => !item.read_at).length
  const labels: Record<string, string> = { like: 'Someone liked your profile.', save: 'Someone saved your profile.', match: 'You have a new mutual match!', message: 'You have a new message.', system: 'A new ROOMIE update.' }
  return <div className="notification-wrap"><button className="notification-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Bell size={17} />{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</button>{open && <div className="notification-popover"><strong>Notifications</strong>{notice && <small role="alert" className="notification-error">{notice}</small>}{items.length ? items.map((item) => <button key={item.id} className={`notification-item${item.read_at ? '' : ' unread'}`} onClick={() => void markRead(item.id)}><span>{labels[item.kind] ?? labels.system}</span><small>{new Date(item.created_at).toLocaleString()}</small></button>) : <p>You’re all caught up.</p>}</div>}</div>
}

function Dashboard({ profile }: { profile: Profile | null }) {
  const { user } = useAuth()
  const [stats, setStats] = useState({ matches: 0, likes: 0, chats: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!supabase || !user) return
    void Promise.all([
      supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('target_id', user.id).eq('action', 'like'),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id),
    ]).then(([matches, likes, messages]) => {
      setStats({ matches: matches.count ?? 0, likes: likes.count ?? 0, chats: messages.count ?? 0 })
      setLoading(false)
    })
  }, [user])
  const completion = profile ? [profile.full_name, profile.age, profile.city, profile.bio, profile.photo_url, profile.budget_max].filter(Boolean).length / 6 * 100 : 0
  const statCards: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: 'Your matches', value: stats.matches, Icon: Heart },
    { label: 'Likes received', value: stats.likes, Icon: Sparkles },
    { label: 'New messages', value: stats.chats, Icon: MessageCircle },
  ]
  return <><PageTitle eyebrow="A LITTLE SPACE, ALL YOURS" title="Your dashboard" description="A good place to start finding your next flatmate." /><div className="dashboard-welcome card-surface"><div><div className="section-kicker">MAKE YOURSELF AT HOME</div><h2>{profile ? 'Your next great flatshare starts here.' : 'Let’s get to know your kind of home.'}</h2><p>{profile ? 'Your profile helps us find people whose everyday life fits with yours.' : 'Add a few details to help us find people whose budgets, routines, and plans line up with yours.'}</p><NavLink to="/app/profile" className="button button-lime">{profile ? 'Update your profile' : 'Build your profile'} <span>→</span></NavLink></div><div className="welcome-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span>r.</span></div></div><div className="stat-grid">{statCards.map(({ label, value, Icon }) => <div className="stat-card card-surface" key={label}><span className="stat-icon"><Icon size={17} /></span><small>{label}</small><strong>{loading ? '—' : value}</strong></div>)}</div><div className="dashboard-lower"><section className="card-surface completion-card"><div className="section-kicker">YOUR PROFILE</div><h3>{profile ? 'A little more about you' : 'Start with the basics'}</h3><div className="progress-track"><span style={{ width: `${completion}%` }} /></div><div className="completion-label"><span>{Math.round(completion)}% complete</span><NavLink to="/app/profile">Continue setup <ArrowDownUp size={13} /></NavLink></div><p>More details make it easier for the right flatmate to find you.</p></section><section className="card-surface next-card"><div className="section-kicker">A GOOD NEXT STEP</div><h3>Explore your possibilities</h3><p>See who’s looking for a place and what a good match looks like.</p><NavLink to="/app/discover" className="text-link">Go to Discover <span>→</span></NavLink></section></div></>
}

function Discover({ profile }: { profile: Profile | null }) {
  const { user } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [cityFilter, setCityFilter] = useState('')
  const [budgetFilter, setBudgetFilter] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [details, setDetails] = useState<MatchProfile | null>(null)
  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    let profileQuery = supabase.from('profiles').select(profileColumns).eq('is_visible', true).gte('age', 18).neq('id', user.id)
    if (filters.city) profileQuery = profileQuery.ilike('city', `%${filters.city}%`)
    if (filters.areas?.length) profileQuery = profileQuery.overlaps('areas', filters.areas)
    if (filters.budget_max != null) profileQuery = profileQuery.lte('budget_min', filters.budget_max)
    for (const key of ['smoking', 'work', 'cleanliness'] as const) {
      if (filters[key]) profileQuery = profileQuery.eq(`lifestyle->>${key}`, filters[key])
    }
    const [profiles, interactions, blocks] = await Promise.all([
      profileQuery.limit(100),
      supabase.from('likes').select('target_id').eq('user_id', user.id),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
    ])
    const failure = profiles.error ?? interactions.error ?? blocks.error
    if (failure) { setNotice(failure.message); setLoading(false); return }
    const hidden = new Set([user.id, ...(interactions.data ?? []).map((item) => item.target_id), ...(blocks.data ?? []).map((item) => item.blocked_id)])
    const candidates = (profiles.data ?? []).filter((item) => !hidden.has(item.id)) as Profile[]
    const ranked = profile ? candidates.sort((a, b) => scoreMatch(profile, b).total - scoreMatch(profile, a).total) : candidates
    setPeople(ranked); setIndex(0); setLoading(false)
  }, [user, profile, filters])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const applyAiSearch = async () => {
    const term = query.trim()
    if (!term) { setFilters({}); return }
    if (!supabase) { setNotice('Connect Supabase to search profiles.'); return }
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', { body: { query: term } })
      if (error) throw error
      const parsed = data?.filters as SearchFilters | undefined
      const next = parsed ?? { city: term }
      setFilters(next)
      setCityFilter(next.city ?? '')
      setBudgetFilter(next.budget_max == null ? '' : String(next.budget_max))
      setIndex(0)
      setNotice(parsed && Object.values(parsed).some((value) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0))
        ? 'Search interpreted and applied to real profile data.'
        : 'No specific filters were found. Try the standard filters below.')
    } catch (caught) {
      setNotice(`AI search is unavailable. Use the standard filters below. ${caught instanceof Error ? caught.message : ''}`)
    } finally { setBusy(false) }
  }

  const shown = useMemo(() => people.filter((candidate) => {
    if (filters.city && !candidate.city?.toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.areas?.length && !filters.areas.some((area) => candidate.areas.some((candidateArea) => candidateArea.toLowerCase().includes(area.toLowerCase())))) return false
    if (filters.budget_max != null && (candidate.budget_min == null || candidate.budget_min > filters.budget_max)) return false
    return ['smoking', 'work', 'cleanliness'].every((key) => {
      const wanted = filters[key as keyof SearchFilters]
      return typeof wanted !== 'string' || candidate.lifestyle[key]?.toString().toLowerCase() === wanted.toLowerCase()
    })
  }), [people, filters])
  const person = shown[index]
  const breakdown = person && profile ? scoreMatch(profile, person) : null
  const act = async (action: 'like' | 'pass' | 'save') => {
    if (!supabase || !user || !person) return
    setBusy(true); setNotice('')
    const result = action === 'save'
      ? await supabase.from('saved_profiles').upsert({ user_id: user.id, profile_id: person.id }, { onConflict: 'user_id,profile_id' })
      : await supabase.rpc('record_like', { target_profile_id: person.id, like_action: action })
    if (result.error) { setNotice(result.error.message); setBusy(false); return }
    if (action === 'like' && result.data) setNotice('It’s a mutual like! You can find your match in My matches.')
    else if (action === 'save') setNotice('Profile saved.')
    setIndex((current) => current + 1); setBusy(false)
  }
  return <><PageTitle eyebrow="MEET YOUR KIND OF PEOPLE" title="Discover" description="Real profiles. Clear preferences. A better start to living together." /><div className="search-bar"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void applyAiSearch() }} placeholder="Try “quiet flatmate in Indiranagar under 20k”" aria-label="Search flatmates" /><button className="button button-lime button-small" disabled={busy} onClick={() => void applyAiSearch()}><Sparkles size={14} /> AI search</button></div><div className="standard-filters"><label>City<input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Any city" /></label><label>Budget up to (₹)<input type="number" min="0" value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value)} placeholder="Any budget" /></label><button className="button button-outline button-small" onClick={() => { setFilters({ city: cityFilter || undefined, budget_max: budgetFilter ? Number(budgetFilter) : undefined }); setIndex(0) }}>Apply filters</button><button className="text-link" onClick={() => { setFilters({}); setCityFilter(''); setBudgetFilter(''); setQuery(''); setIndex(0) }}>Clear</button></div>{notice && <p className="inline-notice" role="status">{notice}</p>}
    {!profile ? <div className="empty-state card-surface"><div className="empty-icon"><UserRound /></div><h2>Tell us what you’re looking for</h2><p>Complete your profile first. Your preferences help us show compatibility honestly—never with made-up scores.</p><NavLink to="/app/profile" className="button button-lime">Set up my profile</NavLink></div> : loading ? <div className="loading-card card-surface">Finding profiles…</div> : !person ? <div className="empty-state card-surface"><div className="empty-icon"><Compass /></div><h2>You’re all caught up</h2><p>{shown.length === 0 ? 'No profiles match this search right now. Try a different area or clear your search.' : 'There are no more profiles to show just now. Check back soon.'}</p><button className="button button-outline" onClick={() => { setFilters({}); setCityFilter(''); setBudgetFilter(''); setQuery(''); setIndex(0); void load() }}>Refresh profiles</button></div> : <div className="discover-layout"><article className="person-card card-surface"><div className="person-photo">{person.photo_url ? <img src={person.photo_url} alt={`${person.full_name}'s profile`} /> : <div className="photo-placeholder"><UserRound size={54} /><span>Photo not added</span></div>}{breakdown && <div className="match-score"><Heart size={14} /> {breakdown.total}% fit</div>}</div><div className="person-info"><div className="person-heading"><div><h2>{person.full_name}{person.age ? `, ${person.age}` : ''}</h2><p>{[person.profession, person.city].filter(Boolean).join(' · ') || 'ROOMIE member'}</p></div><button className="icon-button" onClick={() => setDetails(person)} aria-label="View profile details"><ArrowDownUp size={16} /></button></div>{person.bio && <p className="person-bio">{person.bio}</p>}<div className="person-facts">{person.areas.length > 0 ? <span>{person.areas.join(' · ')}</span> : person.hide_exact_locality && <span>Exact areas hidden</span>}{person.budget_min != null && person.budget_max != null && <span>₹{person.budget_min.toLocaleString()}–₹{person.budget_max.toLocaleString()}</span>}{person.room_type && <span>{person.room_type} room</span>}</div>{breakdown && <div className="match-breakdown"><h3>How you line up</h3><div>{[['Budget', breakdown.budget, 25], ['Area', breakdown.location, 20], ['Lifestyle', breakdown.lifestyle, 30], ['Move-in', breakdown.moveIn, 15], ['Room type', breakdown.roomType, 10]].map(([label, score, max]) => <div className="factor-row" key={String(label)}><span>{label as string}</span><div className="factor-track"><i style={{ width: `${Number(score) / Number(max) * 100}%` }} /></div><small>{score as number}/{max as number}</small></div>)}</div></div>}<div className="card-actions"><button disabled={busy} className="round-action pass-action" aria-label="Pass profile" onClick={() => void act('pass')}><X /></button><button disabled={busy} className="round-action save-action" aria-label="Save profile" onClick={() => void act('save')}><Bookmark /></button><button disabled={busy} className="round-action like-action" aria-label="Like profile" onClick={() => void act('like')}><Heart fill="currentColor" /></button></div></div></article><aside className="discover-aside card-surface"><span className="section-kicker">YOUR PREFERENCES</span><h3>Looking for a good fit?</h3><p>Compatibility is calculated from profile fields you both choose to share.</p><div className="aside-tips"><span><Check size={15} /> Real people, real details</span><span><Check size={15} /> Every factor shown clearly</span><span><Check size={15} /> No random percentages</span></div><NavLink to="/app/profile" className="text-link">Update my preferences →</NavLink></aside></div>}
    {details && <div className="modal-backdrop" onClick={() => setDetails(null)}><section className="detail-modal card-surface" onClick={(event) => event.stopPropagation()}><button className="modal-close icon-button" onClick={() => setDetails(null)} aria-label="Close profile"><X /></button><span className="section-kicker">ROOMIE PROFILE</span><h2>{(people.find((candidate) => candidate.id === details.id))?.full_name}</h2><p>{(people.find((candidate) => candidate.id === details.id))?.bio || 'This member has not added a bio yet.'}</p><p>{(people.find((candidate) => candidate.id === details.id))?.areas.join(' · ')}</p><button className="button button-lime" onClick={() => { setDetails(null); void act('like') }}>Like profile <Heart size={15} /></button><SafetyActions targetId={details.id} /></section></div>}
  </>
}

function Matches() {
  const { user } = useAuth()
  const [rows, setRows] = useState<{ id: string; other: Profile; created_at: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase || !user) return
    void (async () => {
      const { data, error: queryError } = await supabase.from('matches').select('*').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order('created_at', { ascending: false })
      if (queryError) { setError(queryError.message); return }
      const ids = (data ?? []).map((match) => match.user_a === user.id ? match.user_b : match.user_a)
      if (!ids.length) { setRows([]); return }
      const { data: profiles, error: profileError } = await supabase.from('profiles').select(profileColumns).in('id', ids)
      if (profileError) { setError(profileError.message); return }
      setRows((data ?? []).flatMap((match) => {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a
        const other = (profiles ?? []).find((profile) => profile.id === otherId) as Profile | undefined
        return other ? [{ id: match.id, other, created_at: match.created_at }] : []
      }))
    })()
  }, [user])
  return <><PageTitle eyebrow="IT TAKES TWO" title="My matches" description="A mutual like is only the beginning. Get to know each other at your own pace." />{error && <p role="alert" className="inline-notice">{error}</p>}{rows.length ? <div className="matches-grid">{rows.map((row) => <article className="match-card card-surface" key={row.id}><div className="avatar match-avatar">{row.other.full_name.slice(0, 1)}</div><h3>{row.other.full_name}</h3><p>{row.other.city || 'ROOMIE member'}</p><NavLink to="/app/messages" className="button button-lime button-small">Say hello <MessageCircle size={14} /></NavLink><Journey matchId={row.id} targetUserId={row.other.id} /><SafetyActions targetId={row.other.id} /></article>)}</div> : <div className="empty-state card-surface"><div className="empty-icon"><Heart /></div><h2>Your story starts with a like</h2><p>When you and another flatmate both like each other, your match and private chat will appear here.</p><NavLink to="/app/discover" className="button button-lime">Explore flatmates</NavLink></div>}</>
}

function Journey({ matchId, targetUserId }: { matchId: string; targetUserId: string }) {
  const { user } = useAuth()
  const [state, setState] = useState<{ step: number; confirmed_by_me?: boolean; confirmed_by_them?: boolean; met_by_me?: boolean; met_by_them?: boolean; comfortable_by_me?: boolean; comfortable_by_them?: boolean; paused?: boolean } | null>(null)
  const [proposal, setProposal] = useState<{ id: string; proposed_by: string; place: string; proposed_at: string; status: string } | null>(null)
  const [place, setPlace] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!supabase) return
    const [journey, proposals] = await Promise.all([
      supabase.rpc('get_match_journey', { target_match_id: matchId }),
      supabase.from('meeting_proposals').select('id,proposed_by,place,proposed_at,status').eq('match_id', matchId).order('created_at', { ascending: false }).limit(1),
    ])
    if (journey.error) setError(journey.error.message)
    else setState(journey.data as typeof state)
    if (proposals.error) setError(proposals.error.message)
    else setProposal(proposals.data?.[0] ?? null)
  }, [matchId])
  useEffect(() => {
    if (!supabase) return
    void Promise.resolve().then(load)
    const channel = supabase.channel(`journey-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_journeys', filter: `match_id=eq.${matchId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_proposals', filter: `match_id=eq.${matchId}` }, () => void load())
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [load, matchId])
  const confirm = async () => {
    if (!supabase) return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('confirm_match_journey', { target_match_id: matchId })
    if (rpcError) setError(rpcError.message)
    else await load()
    setBusy(false)
  }
  const propose = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !meetingTime) return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('propose_meeting', { target_match_id: matchId, meeting_place: place, meeting_time: new Date(meetingTime).toISOString() })
    if (rpcError) setError(rpcError.message)
    else { setPlace(''); setMeetingTime(''); await load() }
    setBusy(false)
  }
  const respond = async (accepted: boolean) => {
    if (!supabase || !proposal) return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('respond_to_meeting', { target_proposal_id: proposal.id, accepted })
    if (rpcError) setError(rpcError.message)
    else await load()
    setBusy(false)
  }
  const mark = async (outcome: 'met' | 'comfortable') => {
    if (!supabase) return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('mark_meeting_outcome', { target_match_id: matchId, outcome })
    if (rpcError) setError(rpcError.message)
    else await load()
    setBusy(false)
  }
  const unmatch = async () => {
    if (!supabase || !window.confirm('Unmatch and remove this conversation?')) return
    const { error: rpcError } = await supabase.rpc('unmatch_user', { target_user_id: targetUserId })
    if (rpcError) setError(rpcError.message)
  }
  return <div className="journey"><strong>YOUR JOURNEY</strong><div className="journey-steps">{['Match', 'Chat together', 'Meet in person'].map((step, index) => <span className={state && state.step > index ? 'done' : ''} key={step}>{index + 1}. {step}</span>)}</div>{state?.step === 1 && <button className="journey-confirm" disabled={busy || state.confirmed_by_me} onClick={() => void confirm()}>{state.confirmed_by_me ? state.confirmed_by_them ? 'Both confirmed' : 'Confirmed by you · waiting for them' : 'Confirm this flatmate'}</button>}{state?.step === 2 && !state.paused && <div className="meeting-journey"><strong>Meet safely, in a public place</strong>{proposal && <p>{proposal.place} · {new Date(proposal.proposed_at).toLocaleString()}</p>}{proposal?.status === 'pending' && proposal.proposed_by !== user?.id && <div className="journey-meeting-actions"><button disabled={busy} onClick={() => void respond(true)}>Accept</button><button disabled={busy} onClick={() => void respond(false)}>Suggest another</button></div>}{proposal?.status === 'pending' && proposal.proposed_by === user?.id && <small>Waiting for your match to respond.</small>}{(!proposal || proposal.status === 'declined') && <form onSubmit={(event) => void propose(event)}><input required minLength={2} maxLength={200} value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Public place" /><input required type="datetime-local" value={meetingTime} onChange={(event) => setMeetingTime(event.target.value)} /><button disabled={busy}>Propose a time</button></form>}{proposal?.status === 'accepted' && <button disabled={busy || state.met_by_me} onClick={() => void mark('met')}>{state.met_by_me ? state.met_by_them ? 'You both met' : 'Marked by you · waiting' : 'We met'}</button>}</div>}{state?.step === 3 && !state.paused && <div className="meeting-journey"><strong>After your meeting</strong><p>Only continue if you both feel comfortable. Meet in public, tell a friend, and share your location.</p><button disabled={busy || state.comfortable_by_me} onClick={() => void mark('comfortable')}>{state.comfortable_by_me ? state.comfortable_by_them ? 'You both feel comfortable' : 'Confirmed by you · waiting' : 'I’m comfortable to proceed'}</button></div>}{state?.paused && <small className="field-error">This journey is paused while a report is reviewed.</small>}<button className="journey-unmatch" onClick={() => void unmatch()}>Unmatch</button>{error && <small className="field-error">{error}</small>}<NavLink to="/app/messages" className="journey-chat">Open chat →</NavLink></div>
}

function Messages() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<{ id: string; other: Profile }[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refreshMessages = useCallback(async (matchId: string) => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.from('messages').select('id,sender_id,body,created_at,read_at').eq('match_id', matchId).order('created_at')
    if (queryError) setError(queryError.message)
    else {
      setMessages(data as Message[])
      if (data?.some((message) => message.sender_id !== user?.id && !message.read_at)) {
        const { error: readError } = await supabase.rpc('mark_match_messages_read', { target_match_id: matchId })
        if (readError) setError(readError.message)
      }
    }
  }, [user])
  useEffect(() => {
    if (!supabase || !user) return
    void (async () => {
      const { data, error: queryError } = await supabase.from('matches').select('*').or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      if (queryError) { setError(queryError.message); return }
      const ids = (data ?? []).map((item) => item.user_a === user.id ? item.user_b : item.user_a)
      const profiles = ids.length ? await supabase.from('profiles').select(profileColumns).in('id', ids) : { data: [], error: null }
      if (profiles.error) { setError(profiles.error.message); return }
      const conversations = (data ?? []).flatMap((match) => {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a
        const other = (profiles.data ?? []).find((p) => p.id === otherId) as Profile | undefined
        return other ? [{ id: match.id, other }] : []
      })
      setMatches(conversations)
      if (conversations[0]) setSelected((current) => current || conversations[0].id)
    })()
  }, [user])
  useEffect(() => {
    if (!selected || !supabase) return
    void Promise.resolve().then(() => refreshMessages(selected))
    const channel = supabase.channel(`messages-${selected}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${selected}` }, () => void refreshMessages(selected)).subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [selected, refreshMessages])
  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user || !selected || !body.trim()) return
    setBusy(true); setError('')
    const { error: insertError } = await supabase.from('messages').insert({ match_id: selected, sender_id: user.id, recipient_id: conversation?.other.id, body: body.trim() })
    if (insertError) setError(insertError.message)
    else { setBody(''); await refreshMessages(selected) }
    setBusy(false)
  }
  const conversation = matches.find((item) => item.id === selected)
  return <><PageTitle eyebrow="THE CONVERSATION STARTS HERE" title="Messages" description="Take the time to get to know your match before meeting." />{error && <p className="inline-notice">{error}</p>}{matches.length ? <div className="chat-layout card-surface"><aside className="chat-list"><strong>YOUR MATCHES</strong>{matches.map(({ id, other }) => <button className={`chat-person${id === selected ? ' selected' : ''}`} key={id} onClick={() => setSelected(id)}><span className="avatar">{other.full_name.slice(0, 1)}</span><span>{other.full_name}<small>{other.city || 'Your match'}</small></span></button>)}</aside><section className="chat-panel"><header><span className="avatar">{conversation?.other.full_name.slice(0, 1)}</span><div><strong>{conversation?.other.full_name}</strong><small>Matched on ROOMIE</small></div></header><div className="message-list">{messages.map((message) => <div key={message.id} className={`message-bubble${message.sender_id === user?.id ? ' mine' : ''}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}{messages.length === 0 && <p className="chat-empty">A good conversation can start with a simple hello.</p>}</div><form className="message-compose" onSubmit={(event) => void send(event)}><input value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Write a message…" aria-label="Message" /><button className="button button-lime button-small" disabled={busy || !body.trim()}>Send <span>→</span></button></form></section></div> : <div className="empty-state card-surface"><div className="empty-icon"><MessageCircle /></div><h2>Your conversations will live here</h2><p>Once you and another person like each other, you can chat here—no one else can see your messages.</p><NavLink to="/app/discover" className="button button-lime">Meet flatmates</NavLink></div>}</>
}

function SafetyActions({ targetId }: { targetId: string }) {
  const { user } = useAuth()
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('safety_concern')
  const [details, setDetails] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const report = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user) return
    setBusy(true); setNotice('')
    const { error } = await supabase.rpc('submit_report', { target_user_id: targetId, report_reason: reason, report_details: details })
    if (error) setNotice(error.message)
    else { setNotice('Your report has been sent to the safety team.'); setReporting(false) }
    setBusy(false)
  }
  const block = async () => {
    if (!supabase || !user) return
    setBusy(true); setNotice('')
    const { error } = await supabase.from('blocks').upsert({ blocker_id: user.id, blocked_id: targetId })
    if (error) setNotice(error.message)
    else setNotice('This profile is blocked. You will no longer see each other in Discover.')
    setBusy(false)
  }
  return <div className="safety-actions"><div><button className="text-link" onClick={() => setReporting((value) => !value)}>Report profile</button><button className="text-link safety-block" disabled={busy} onClick={() => void block()}>Block</button></div>{reporting && <form onSubmit={(event) => void report(event)}><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="safety_concern">Safety concern</option><option value="fake_profile">Fake or misleading profile</option><option value="harassment">Harassment</option><option value="other">Other</option></select></label><label>Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} placeholder="Share any details that may help our review." /></label><button className="button button-outline button-small" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></form>}{notice && <small role="status">{notice}</small>}</div>
}

function AdminPanel() {
  const { user } = useAuth()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [counts, setCounts] = useState({ members: 0, visible: 0, matches: 0, listings: 0, openReports: 0 })
  const [reports, setReports] = useState<Record<string, unknown>[]>([])
  const [verificationRequests, setVerificationRequests] = useState<Record<string, unknown>[]>([])
  const [targetId, setTargetId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    if (!supabase || !user) return
    const role = await supabase.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (role.error) { setNotice(role.error.message); setAuthorized(false); return }
    if (!role.data) { setAuthorized(false); return }
    setAuthorized(true)
    const [members, visible, matches, listings, open, reportData, verificationData] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_visible', true),
      supabase.from('matches').select('id', { count: 'exact', head: true }),
      supabase.from('property_listings').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('reports').select('id,reporter_id,reported_user_id,reason,details,status,created_at').neq('status', 'resolved').neq('status', 'dismissed').order('created_at', { ascending: false }).limit(50),
      supabase.from('verification_requests').select('id,user_id,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    ])
    const failure = [members, visible, matches, listings, open, reportData, verificationData].find((result) => result.error)
    if (failure?.error) { setNotice(failure.error.message); return }
    setCounts({ members: members.count ?? 0, visible: visible.count ?? 0, matches: matches.count ?? 0, listings: listings.count ?? 0, openReports: open.count ?? 0 })
    setReports(reportData.data ?? [])
    setVerificationRequests(verificationData.data ?? [])
  }, [user])
  useEffect(() => { void Promise.resolve().then(refresh) }, [refresh])
  const suspend = async (suspended: boolean) => {
    if (!supabase || !targetId.trim()) return
    setBusy(true); setNotice('')
    const { error } = await supabase.rpc('admin_set_suspended', { target_user_id: targetId.trim(), suspend_user: suspended })
    if (error) setNotice(error.message)
    else { setNotice(suspended ? 'Account suspended.' : 'Account restored.'); setTargetId(''); await refresh() }
    setBusy(false)
  }
  const review = async (id: string, status: 'reviewing' | 'resolved' | 'dismissed') => {
    if (!supabase) return
    setBusy(true); setNotice('')
    const { error } = await supabase.rpc('admin_review_report', { target_report_id: id, next_status: status })
    if (error) setNotice(error.message)
    else await refresh()
    setBusy(false)
  }
  const reviewVerification = async (id: string, approved: boolean) => {
    if (!supabase) return
    if (approved && !window.confirm('Confirm that identity evidence was reviewed through your approved secure verification process before granting the verified badge.')) return
    setBusy(true); setNotice('')
    const { error } = await supabase.rpc('admin_review_verification', { target_request_id: id, approved })
    if (error) setNotice(error.message)
    else { setNotice(approved ? 'Verification approved.' : 'Verification request declined.'); await refresh() }
    setBusy(false)
  }
  if (authorized === null) return <div className="loading-card card-surface">Checking admin access…</div>
  if (!authorized) return <><PageTitle eyebrow="RESTRICTED AREA" title="Admin panel" /><div className="empty-state card-surface"><div className="empty-icon"><Shield /></div><h2>Admin access required</h2><p>This area is only available to accounts with an admin role.</p></div></>
  return <><PageTitle eyebrow="ROOMIE OPERATIONS" title="Admin panel" description="Review reports and account safety. Every moderation action is audited." /><div className="stat-grid admin-stats">{[['Members', counts.members], ['Visible profiles', counts.visible], ['Mutual matches', counts.matches], ['Active listings', counts.listings], ['Open reports', counts.openReports]].map(([label, count]) => <div className="stat-card card-surface" key={String(label)}><small>{label}</small><strong>{count}</strong></div>)}</div><section className="admin-suspend card-surface"><div><span className="section-kicker">ACCOUNT ACTION</span><h2>Suspend or restore an account</h2><p>Use a profile UUID. This action is recorded in the audit log.</p></div><div className="admin-suspend-form"><input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Profile UUID" aria-label="Profile UUID" /><button className="button button-outline button-small" disabled={busy || !targetId.trim()} onClick={() => void suspend(true)}>Suspend</button><button className="button button-outline button-small" disabled={busy || !targetId.trim()} onClick={() => void suspend(false)}>Restore</button></div></section><section className="admin-reports"><div className="section-kicker">SAFETY QUEUE</div><h2>Open reports</h2>{reports.length ? reports.map((report) => <article className="report-card card-surface" key={String(report.id)}><div><span className="verified-label">{String(report.status).toUpperCase()}</span><h3>{String(report.reason)}</h3><p>{String(report.details || 'No extra details supplied.')}</p><small>Reporter: {String(report.reporter_id)} · Reported profile: {String(report.reported_user_id)}</small></div><div className="report-actions"><button disabled={busy} className="button button-outline button-small" onClick={() => void review(String(report.id), 'reviewing')}>Review</button><button disabled={busy} className="button button-outline button-small" onClick={() => void review(String(report.id), 'resolved')}>Resolve</button><button disabled={busy} className="text-link" onClick={() => void review(String(report.id), 'dismissed')}>Dismiss</button></div></article>) : <div className="empty-state card-surface"><p>No reports need review right now.</p></div>}</section><section className="admin-reports"><div className="section-kicker">IDENTITY REVIEW</div><h2>Verification requests</h2>{verificationRequests.length ? verificationRequests.map((request) => <article className="report-card card-surface" key={String(request.id)}><div><h3>Request from {String(request.user_id)}</h3><p>Submitted {new Date(String(request.created_at)).toLocaleString()}. Review identity documents through your approved secure process before approving.</p></div><div className="report-actions"><button disabled={busy} className="button button-lime button-small" onClick={() => void reviewVerification(String(request.id), true)}>Approve</button><button disabled={busy} className="button button-outline button-small" onClick={() => void reviewVerification(String(request.id), false)}>Decline</button></div></article>) : <div className="empty-state card-surface"><p>No pending verification requests.</p></div>}</section>{notice && <p role="status" className="inline-notice">{notice}</p>}</>
}

function Saved() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase || !user) return
    void (async () => {
      const { data, error: queryError } = await supabase.from('saved_profiles').select('profile_id').eq('user_id', user.id)
      if (queryError) { setError(queryError.message); return }
      const ids = (data ?? []).map((item) => item.profile_id)
      const profiles = ids.length ? await supabase.from('profiles').select(profileColumns).in('id', ids) : { data: [], error: null }
      if (profiles.error) setError(profiles.error.message)
      else setPeople((profiles.data ?? []) as Profile[])
    })()
  }, [user])
  return <><PageTitle eyebrow="KEEP A SHORTLIST" title="Saved profiles" description="Profiles you’d like to come back to." />{error && <p className="inline-notice">{error}</p>}{people.length ? <div className="saved-grid">{people.map((person) => <article className="saved-card card-surface" key={person.id}>{person.photo_url ? <img src={person.photo_url} alt="" /> : <div className="saved-photo-placeholder"><UserRound /></div>}<h3>{person.full_name}{person.age ? `, ${person.age}` : ''}</h3><p>{[person.profession, person.city].filter(Boolean).join(' · ')}</p></article>)}</div> : <div className="empty-state card-surface"><div className="empty-icon"><Bookmark /></div><h2>Save a profile for later</h2><p>Keep people you’re curious about close by while you explore.</p><NavLink to="/app/discover" className="button button-lime">Browse profiles</NavLink></div>}</>
}

function ProfileEditor({ profile, onSave, setError }: { profile: Profile | null; onSave: () => Promise<void>; setError: (message: string) => void }) {
  const { user } = useAuth()
  const [values, setValues] = useState(() => ({
    full_name: profile?.full_name ?? '', age: String(profile?.age ?? ''), profession: profile?.profession ?? '',
    city: profile?.city ?? '', areas: profile?.areas.join(', ') ?? '', bio: profile?.bio ?? '',
    budget_min: String(profile?.budget_min ?? ''), budget_max: String(profile?.budget_max ?? ''),
    move_in_date: profile?.move_in_date ?? '', room_type: profile?.room_type ?? 'private',
    hide_exact_locality: profile?.hide_exact_locality ?? false,
    lifestyle: {
      smoking: String(profile?.lifestyle.smoking ?? 'no'),
      work: String(profile?.lifestyle.work ?? 'office'),
      cleanliness: String(profile?.lifestyle.cleanliness ?? 'tidy'),
    },
  }))
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(profile?.photo_url ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!photoPreview.startsWith('blob:')) return
    return () => URL.revokeObjectURL(photoPreview)
  }, [photoPreview])
  const change = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user) return
    if (!values.full_name.trim() || !values.city.trim()) { setNotice('Your name and city are required.'); return }
    if (Number(values.age) < 18) { setNotice('Profiles are only available to people aged 18 or older.'); return }
    if (!profile?.photo_url && !photo) { setNotice('Add a profile photo to complete your profile.'); return }
    if (photo && (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) { setNotice('Choose a JPG, PNG, or WebP photo under 5 MB.'); return }
    setBusy(true); setNotice(''); setError('')
    try {
      let photoUrl = profile?.photo_url ?? null
      if (photo) {
        const path = `${user.id}/avatar-${Date.now()}.${photo.type.split('/')[1].replace('jpeg', 'jpg')}`
        const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, photo, { upsert: true, contentType: photo.type })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('profile-photos').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
        const areas = [...new Set(values.areas.split(',').map((area) => area.trim()).filter(Boolean))]
        const { error: clearAreasError } = await supabase.from('preferred_areas').delete().eq('user_id', user.id)
        if (clearAreasError) throw clearAreasError
        if (areas.length) {
          const { error: areasError } = await supabase.from('preferred_areas').insert(
            areas.map((area) => ({ user_id: user.id, city: values.city.trim(), area })),
          )
          if (areasError) throw areasError
        }
        const { data: savedProfile, error: saveError } = await supabase.from('profiles').update({
          full_name: values.full_name.trim(), age: Number(values.age), profession: values.profession.trim() || null,
          city: values.city.trim(), areas: values.hide_exact_locality ? [] : areas, hide_exact_locality: values.hide_exact_locality, bio: values.bio.trim() || null,
          budget_min: values.budget_min ? Number(values.budget_min) : null, budget_max: values.budget_max ? Number(values.budget_max) : null,
          move_in_date: values.move_in_date || null, room_type: values.room_type, lifestyle: values.lifestyle, photo_url: photoUrl, is_visible: true,
        }).eq('id', user.id).select('id').maybeSingle()
        if (saveError) throw saveError
        if (!savedProfile) throw new Error('Your profile record is missing. Please contact your ROOMIE deployment administrator.')
      await onSave(); setNotice('Your profile is saved.')
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Unable to save profile.') }
    finally { setBusy(false) }
  }
  return <><PageTitle eyebrow="MAKE IT YOURS" title="My profile" description="Your details help us find people who fit your everyday life." /><form className="profile-form card-surface" onSubmit={(event) => void save(event)}><div className="profile-form-section"><div className="section-kicker">THE ESSENTIALS</div><div className="form-grid"><label>Full name<input required value={values.full_name} onChange={(event) => change('full_name', event.target.value)} autoComplete="name" /></label><label>Age (18+)<input type="number" min="18" max="120" required value={values.age} onChange={(event) => change('age', event.target.value)} /></label><label>City<input required value={values.city} onChange={(event) => change('city', event.target.value)} placeholder="e.g. Bengaluru" /></label><label>Profession<input value={values.profession} onChange={(event) => change('profession', event.target.value)} placeholder="What do you do?" /></label><label className="full-field">Areas you prefer <small>Separate localities with commas</small><input value={values.areas} onChange={(event) => change('areas', event.target.value)} placeholder="Indiranagar, Koramangala" /></label><label className="check-label full-field"><input type="checkbox" checked={values.hide_exact_locality} onChange={(event) => setValues((current) => ({ ...current, hide_exact_locality: event.target.checked }))} /><span>Hide my exact areas from other members. They’ll only see my city; my preferences remain private.</span></label><label className="full-field">A little about you<textarea value={values.bio} maxLength={500} onChange={(event) => change('bio', event.target.value)} placeholder="What makes a place feel like home to you?" /></label><label className="full-field">Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setPhoto(selected); setPhotoPreview(selected ? URL.createObjectURL(selected) : profile?.photo_url ?? '') }} /><small>JPG, PNG, or WebP. Maximum 5 MB.</small>{photoPreview && <img className="profile-photo-preview" src={photoPreview} alt="Profile photo preview" />}</label></div></div><div className="profile-form-section"><div className="section-kicker">YOUR HOME & ROUTINE</div><div className="form-grid"><label>Budget minimum (₹ / month)<input type="number" min="0" value={values.budget_min} onChange={(event) => change('budget_min', event.target.value)} /></label><label>Budget maximum (₹ / month)<input type="number" min="0" value={values.budget_max} onChange={(event) => change('budget_max', event.target.value)} /></label><label>Move-in date<input type="date" value={values.move_in_date} onChange={(event) => change('move_in_date', event.target.value)} /></label><label>Room preference<select value={values.room_type} onChange={(event) => change('room_type', event.target.value)}><option value="private">Private room</option><option value="shared">Shared room</option><option value="either">Either</option></select></label><label>Smoking preference<select value={values.lifestyle.smoking} onChange={(event) => setValues((current) => ({ ...current, lifestyle: { ...current.lifestyle, smoking: event.target.value } }))}><option value="no">Non-smoker</option><option value="yes">Smoker</option><option value="either">No preference</option></select></label><label>Work routine<select value={values.lifestyle.work} onChange={(event) => setValues((current) => ({ ...current, lifestyle: { ...current.lifestyle, work: event.target.value } }))}><option value="office">Mostly in office</option><option value="hybrid">Hybrid</option><option value="home">Mostly at home</option></select></label><label>Home style<select value={values.lifestyle.cleanliness} onChange={(event) => setValues((current) => ({ ...current, lifestyle: { ...current.lifestyle, cleanliness: event.target.value } }))}><option value="tidy">Prefer tidy spaces</option><option value="relaxed">Relaxed about mess</option><option value="either">Somewhere in between</option></select></label></div></div>{notice && <div role="status" className="form-message form-success">{notice}</div>}<button className="button button-lime" disabled={busy}>{busy ? 'Saving…' : 'Save profile'} <Check size={16} /></button></form><ProfileJourneys /></>
}

function ProfileJourneys() {
  const { user } = useAuth()
  const [journeys, setJourneys] = useState<{ matchId: string; targetUserId: string }[]>([])
  useEffect(() => {
    if (!supabase || !user) return
    void (async () => {
      const { data, error } = await supabase.from('matches').select('id,user_a,user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      if (error) return
      setJourneys((data ?? []).map((match) => ({ matchId: match.id, targetUserId: match.user_a === user.id ? match.user_b : match.user_a })))
    })()
  }, [user])
  return <section className="profile-journeys"><div className="section-kicker">YOUR ROOMIE JOURNEYS</div><h2>Matches, at your pace</h2>{journeys.length ? journeys.map((journey) => <div className="card-surface profile-journey" key={journey.matchId}><Journey {...journey} /></div>) : <p>Your shared journey tracker will appear here when you make a mutual match.</p>}</section>
}

function Listings() {
  const { user } = useAuth()
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState({ title: '', city: '', locality: '', rent: '', rooms: '1', description: '', contact_email: user?.email ?? '' })
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.from('property_listings').select('*').eq('status', 'active').order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setItems(data ?? [])
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user) return
    setBusy(true); setError('')
    const { error: insertError } = await supabase.from('property_listings').insert({ owner_id: user.id, title: values.title, city: values.city, locality: values.locality, rent: Number(values.rent), rooms_available: Number(values.rooms), description: values.description, contact_email: values.contact_email })
    if (insertError) setError(insertError.message)
    else { setShowForm(false); setValues({ title: '', city: '', locality: '', rent: '', rooms: '1', description: '', contact_email: user?.email ?? '' }); await load() }
    setBusy(false)
  }
  const remove = async (id: string) => {
    if (!supabase) return
    const { error: deleteError } = await supabase.from('property_listings').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setItems((current) => current.filter((item) => item.id !== id))
  }
  return <><PageTitle eyebrow="A PLACE TO CALL YOUR OWN" title="Find a home" description="Browse homes shared by community members. Owner-supplied details are clearly labeled." ><button className="button button-lime button-small" onClick={() => setShowForm((value) => !value)}><Plus size={15} /> Add a listing</button></PageTitle>{error && <p role="alert" className="inline-notice">{error}</p>}{showForm && <form className="profile-form card-surface listing-form" onSubmit={(event) => void create(event)}><div className="section-kicker">YOUR LISTING</div><div className="form-grid"><label>Title<input required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></label><label>City<input required value={values.city} onChange={(event) => setValues({ ...values, city: event.target.value })} /></label><label>Locality<input required value={values.locality} onChange={(event) => setValues({ ...values, locality: event.target.value })} /></label><label>Monthly rent (₹)<input type="number" required min="1" value={values.rent} onChange={(event) => setValues({ ...values, rent: event.target.value })} /></label><label>Rooms available<input type="number" min="1" value={values.rooms} onChange={(event) => setValues({ ...values, rooms: event.target.value })} /></label><label>Enquiry email<input type="email" required value={values.contact_email} onChange={(event) => setValues({ ...values, contact_email: event.target.value })} /><small>This address will be visible to signed-in members on this listing.</small></label><label className="full-field">Description<textarea required value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label></div><button className="button button-lime" disabled={busy}>Publish listing</button></form>}{items.length ? <div className="listing-grid">{items.map((item) => <article className="listing-card card-surface" key={String(item.id)}><div className="listing-illustration"><Home size={30} /><span>COMMUNITY LISTING</span></div><div className="listing-copy"><span className="verified-label">USER-SUPPLIED</span><h3>{String(item.title)}</h3><p>{String(item.locality)}, {String(item.city)}</p><strong>₹{Number(item.rent).toLocaleString()}<small> / month</small></strong><p>{String(item.description)}</p>{item.owner_id === user?.id ? <button className="text-link" onClick={() => void remove(String(item.id))}>Remove your listing <X size={13} /></button> : <a className="text-link" href={`mailto:${String(item.contact_email)}?subject=${encodeURIComponent(`Enquiry: ${String(item.title)}`)}`}>Enquire with owner →</a>}</div></article>)}</div> : <div className="empty-state card-surface"><div className="empty-icon"><Home /></div><h2>No homes listed just yet</h2><p>Be the first to share a place with the community.</p><button className="button button-outline" onClick={() => setShowForm(true)}>Add a listing</button></div>}</>
}

function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(true)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  useEffect(() => {
    if (!supabase || !user) return
    void supabase.from('profiles').select('is_visible').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (error) setNotice(error.message)
      else if (data) setVisible(data.is_visible)
    })
    void supabase.from('verification_requests').select('status').eq('user_id', user.id).maybeSingle().then(({ data, error }) => {
      if (error) setNotice(error.message)
      else if (data) setVerificationStatus(data.status)
    })
  }, [user])
  const toggle = async () => {
    if (!supabase || !user) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ is_visible: !visible }).eq('id', user.id)
    if (error) setNotice(error.message)
    else { setVisible(!visible); setNotice('Your visibility preference is updated.') }
    setBusy(false)
  }
  const requestVerification = async () => {
    if (!supabase || !user) return
    setBusy(true); setNotice('')
    const { data, error } = await supabase.from('verification_requests').insert({ user_id: user.id }).select('status').single()
    if (error) setNotice(error.message)
    else { setVerificationStatus(data.status); setNotice('Your identity review request has been submitted.') }
    setBusy(false)
  }
  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user?.email || deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()) {
      setNotice('Enter your account email exactly to confirm deletion.')
      return
    }
    if (!window.confirm('Permanently delete your ROOMIE account, profile, matches, messages, and uploaded photos? This cannot be undone.')) return
    setBusy(true); setNotice('')
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm_email: deleteConfirm } })
    if (error) { setNotice(error.message); setBusy(false); return }
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }
  return <><PageTitle eyebrow="YOUR ACCOUNT, YOUR CALL" title="Settings" description="Manage how your profile appears to other ROOMIE members." /><section className="settings-card card-surface"><div className="settings-row"><div><h3>Show my profile in Discover</h3><p>When hidden, your profile won’t appear to new people. Existing matches remain available.</p></div><button className={`toggle${visible ? ' on' : ''}`} aria-pressed={visible} disabled={busy} onClick={() => void toggle()}><span /></button></div><div className="settings-row"><div><h3>Account email</h3><p>{user?.email || 'No email available'}</p></div><span className="verified-label"><Shield size={13} /> PRIVATE</span></div><div className="settings-row"><div><h3>Identity review</h3><p>{verificationStatus === 'approved' ? 'Reviewed by a ROOMIE administrator.' : verificationStatus === 'pending' ? 'Your request is waiting for admin review.' : verificationStatus === 'rejected' ? 'Your request was not approved. Contact the service administrator for next steps.' : 'Request a manual identity review. Only an administrator can grant a verified badge.'}</p></div>{verificationStatus !== 'approved' && verificationStatus !== 'pending' && <button className="button button-outline button-small" disabled={busy} onClick={() => void requestVerification()}>Request review</button>}</div></section>{notice && <p role="status" className="inline-notice">{notice}</p>}<div className="safety-note card-surface"><Shield size={20} /><div><strong>Account help</strong><p>Contact the support channel published by your ROOMIE deployment administrator for privacy help.</p></div></div><section className="danger-zone card-surface"><div><span className="section-kicker">ACCOUNT DATA</span><h2>Delete your account</h2><p>This permanently removes your profile, matches, conversations, listings, and uploaded profile photos.</p></div><form onSubmit={(event) => void deleteAccount(event)}><label>Enter your account email to confirm<input type="email" autoComplete="email" required value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user?.email ?? ''} /></label><button className="button danger-button" disabled={busy || !user?.email}>{busy ? 'Deleting…' : 'Permanently delete account'}</button></form></section></>
}
