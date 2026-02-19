import { useState } from "react";

const FH="'Satoshi','Manrope',-apple-system,BlinkMacSystemFont,sans-serif";
const FB="'Satoshi','Manrope',-apple-system,BlinkMacSystemFont,sans-serif";

export default function HelvionWidget(){
  const[color,setColor]=useState("#F59E0B");
  const[wTab,setWTab]=useState("home");
  const[chatView,setChatView]=useState(null);
  const[widgetOpen,setWidgetOpen]=useState(true);
  const colors=["#F59E0B","#7C3AED","#059669","#F97316","#0EA5E9","#EC4899","#1D4ED8","#0F172A"];
  const colorD=color==="#F59E0B"?"#D97706":color==="#7C3AED"?"#5B21B6":color==="#059669"?"#047857":color==="#F97316"?"#EA580C":color==="#0EA5E9"?"#0284C7":color==="#EC4899"?"#DB2777":color==="#1D4ED8"?"#1E40AF":"#020617";
  const colorL=color+"15";

  /* ══════════════════════════════════════
     COMPONENT: Avatars (from Avatars.png)
     - Photo-style circles with gradient bg + initials
     - Online dot (green circle bottom-right)
     - Stack: overlapping with negative margin
     - Bot avatar: rounded square with "H" + lightning
     ══════════════════════════════════════ */
  const Avatar=({bg,ini,sz=34,ml=0,online,border="#FFF"})=>(
    <div style={{position:"relative",marginLeft:ml,zIndex:ml<0?1:2,flexShrink:0}}>
      <div style={{width:sz,height:sz,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FH,fontSize:sz<=28?9:sz<=34?11:13,fontWeight:700,color:"#FFF",border:`2.5px solid ${border}`,boxShadow:"0 1px 3px rgba(0,0,0,.08)"}}>{ini}</div>
      {online&&<div style={{position:"absolute",bottom:0,right:0,width:sz*0.3,height:sz*0.3,borderRadius:"50%",background:"#22C55E",border:`2px solid ${border}`}}/>}
    </div>
  );
  const AvatarStack=({items,sz=38,border="#FFF"})=>(
    <div style={{display:"flex"}}>{items.map((a,i)=>(
      <Avatar key={i} bg={a.bg} ini={a.i} sz={sz} ml={i>0?-10:0} online={a.online} border={border}/>
    ))}</div>
  );
  const teamAvatars=[
    {bg:`linear-gradient(135deg,${color},${colorD})`,i:"AY",online:true},
    {bg:"linear-gradient(135deg,#8B5CF6,#6D28D9)",i:"EK"},
    {bg:"linear-gradient(135deg,#10B981,#059669)",i:"MÖ"},
  ];

  /* ══════════════════════════════════════
     COMPONENT: Bot Icon (from Avatars.png - system icon)
     - Rounded square, brand gradient
     - "H" letter or lightning bolt
     ══════════════════════════════════════ */
  const BotIcon=({sz=32})=>(
    <div style={{width:sz,height:sz,borderRadius:sz*0.28,background:`linear-gradient(135deg,${color},${colorD})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 2px 8px ${color}25`}}>
      <span style={{fontFamily:FH,fontSize:sz*0.4,fontWeight:900,color:"#FFF"}}>H</span>
    </div>
  );
  /* Lightning bot icon variant (from Header.png variant 6) */
  const LightningIcon=({sz=28})=>(
    <div style={{width:sz,height:sz,borderRadius:"50%",background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <svg width={sz*0.5} height={sz*0.5} viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
  );

  /* ══════════════════════════════════════
     COMPONENT: AI Label (from AI Label.png)
     Variant 1: Text only "AI" - small, inline
     Variant 2: Rounded rect badge with filled bg
     ══════════════════════════════════════ */
  const AiLabelText=()=>(
    <span style={{fontFamily:FH,fontSize:11,fontWeight:800,color:"#6B7280",letterSpacing:.3}}>AI</span>
  );
  const AiLabelBadge=()=>(
    <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:6,background:"#6B7280",fontFamily:FH,fontSize:9,fontWeight:800,color:"#FFF",letterSpacing:.5}}>AI</span>
  );
  /* Colored AI badge using brand color */
  const AiBadge=()=>(
    <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:6,background:colorL,fontFamily:FH,fontSize:9,fontWeight:800,color:color,letterSpacing:.5}}>AI</span>
  );

  /* ══════════════════════════════════════
     COMPONENT: chip-news (from chip-news.png)
     - Pill shape, light colored bg, colored text
     ══════════════════════════════════════ */
  const Chip=({label,chipColor})=>(
    <span style={{display:"inline-block",padding:"4px 12px",borderRadius:20,background:(chipColor||color)+"12",fontFamily:FH,fontSize:11,fontWeight:600,color:chipColor||color}}>{label}</span>
  );

  /* ══════════════════════════════════════
     COMPONENT: Chevron arrow (from Tile.png)
     ══════════════════════════════════════ */
  const Chev=({clr})=>(
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={clr||color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
  );

  /* ══════════════════════════════════════
     COMPONENT: Reply / Input Bar (from Reply.png)
     8 variants: empty/filled × white/gray × GIF+emoji+clip / emoji+clip / clip only / send
     We use: empty state with GIF + emoji + clip icons
     ══════════════════════════════════════ */
  const ReplyBar=({gray})=>(
    <div style={{padding:"10px 14px",background:gray?"#F5F5F7":"#FFF",borderTop:"1px solid #EBEBEB",display:"flex",alignItems:"center",gap:2}}>
      <div style={{flex:1,fontFamily:FB,fontSize:13.5,color:"#B0B0B0",padding:"2px 0"}}>Type a reply...</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {/* GIF icon - outlined rounded rect with "GIF" text */}
        <div style={{border:"1.5px solid #D0D0D0",borderRadius:4,padding:"1px 4px",cursor:"pointer",display:"flex",alignItems:"center"}}>
          <span style={{fontFamily:FH,fontSize:9,fontWeight:700,color:"#B0B0B0",letterSpacing:.3}}>GIF</span>
        </div>
        {/* Emoji icon - smiley circle */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{cursor:"pointer"}}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        {/* Paperclip / attachment icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{cursor:"pointer"}}><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     COMPONENT: Nav (from Nav.png)
     4 tabs: Home, Messages, Help, News
     Active: filled icon + brand color text
     Inactive: outline icon + gray text
     Badge: red circle with white number, top-right of icon
     ══════════════════════════════════════ */
  const navItems=[
    {id:"home",l:"Home",
      ic:(a)=>a
        ?<svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5"><path d="M3 9.5L12 3l9 6.5V20a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z"/><rect x="9" y="13" width="6" height="9" rx="1" fill="#FFF"/></svg>
        :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    },
    {id:"messages",l:"Messages",badge:1,
      ic:(a)=>a
        ?<svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="8" y1="9" x2="16" y2="9" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="13" x2="13" y2="13" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/></svg>
        :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    },
    {id:"help",l:"Help",
      ic:(a)=>a
        ?<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill={color}/><text x="12" y="16" textAnchor="middle" fill="#FFF" fontFamily={FH} fontSize="13" fontWeight="800">?</text></svg>
        :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
    {id:"news",l:"News",
      ic:(a)=>a
        ?<svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0" fill="none" stroke={color} strokeWidth="2"/></svg>
        :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
    },
  ];
  const WNav=()=>(
    <div style={{display:"flex",borderTop:"1px solid #EBEBEB",background:"#FFF",padding:"2px 0"}}>
      {navItems.map(n=>{const a=wTab===n.id||(n.id==="messages"&&chatView);return(
        <div key={n.id} onClick={()=>{setWTab(n.id);setChatView(null)}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"9px 0 7px",cursor:"pointer"}}>
          <div style={{position:"relative"}}>
            {n.ic(a)}
            {n.badge&&<div style={{position:"absolute",top:-4,right:-7,minWidth:15,height:15,borderRadius:8,background:"#EF4444",border:"2px solid #FFF",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}><span style={{fontFamily:FH,fontSize:8,fontWeight:800,color:"#FFF"}}>{n.badge}</span></div>}
          </div>
          <span style={{fontFamily:FH,fontSize:10,fontWeight:a?700:500,color:a?color:"#999"}}>{n.l}</span>
        </div>
      )})}
    </div>
  );

  /* ══════════════════════════════════════
     COMPONENT: Branding Footer
     "POWERED BY [H] HELVION"
     ══════════════════════════════════════ */
  const Branding=()=>(
    <div style={{padding:"9px 16px",background:"#FAFAFA",borderTop:"1px solid #F0F0F0",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <span style={{fontFamily:FH,fontSize:9,fontWeight:700,letterSpacing:1.5,color:"#C0C0C0",textTransform:"uppercase"}}>Powered by</span>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <BotIcon sz={15}/>
        <span style={{fontFamily:FH,fontSize:10.5,fontWeight:800,color:"#999",letterSpacing:.5}}>HELVION</span>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     COMPONENT: Header (from Header.png - 9 variants)
     
     V1: Chat header — back + avatar stack + team name
     V2: Chat header — back + avatar stack + team name + response time
     V3: Agent header — back + single avatar (online dot) + name + "Active 1h ago"
     V4: Bot header — back + bot icon + "Fin" + AI badge + "Bot"
     V5: New chat header — back + "Customer Service" + avatar stack centered + "We typically reply..." 
     V6: Home header — avatar stack left + "Hi there 👋" + "How can we help?"
     V7: Home header v2 — lightning icon left + avatars right + same greeting
     V8: Simple header — just "Title" centered
     V9: Help header — "Help" + search bar
     
     We map these to Helvion screens appropriately
     ══════════════════════════════════════ */
  
  /* ===== HOME SCREEN (Header V7 + Tiles) ===== */
  const WHome=()=>(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header V7: lightning left + avatars right + greeting */}
      <div style={{background:`linear-gradient(160deg,${color},${colorD})`,padding:"24px 22px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,position:"relative",zIndex:2}}>
          <LightningIcon sz={30}/>
          <AvatarStack items={teamAvatars} sz={36} border="rgba(255,255,255,.3)"/>
        </div>
        <div style={{position:"relative",zIndex:2}}>
          <div style={{fontFamily:FH,fontSize:24,fontWeight:400,color:"rgba(255,255,255,.8)",lineHeight:1.3}}>Hi there 👋</div>
          <div style={{fontFamily:FH,fontSize:24,fontWeight:800,color:"#FFF",lineHeight:1.3}}>How can we help?</div>
        </div>
      </div>

      {/* Tiles from Tile.png: Recent message, Send message, Search for help */}
      <div style={{flex:1,padding:"12px 14px",background:"#F7F7F8",display:"flex",flexDirection:"column",gap:9,overflowY:"auto"}}>
        {/* Tile: Recent message */}
        <div onClick={()=>{setWTab("messages");setChatView("bot")}} style={{background:"#FFF",border:"1px solid #EBEBEB",borderRadius:14,padding:"14px 16px",cursor:"pointer"}}>
          <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:"#999",marginBottom:10}}>Recent message</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <AvatarStack items={teamAvatars.slice(0,2)} sz={30}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:FB,fontSize:13.5,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Hi there. I'm Helvion Assistant. How can I help...</div>
              <div style={{fontFamily:FB,fontSize:11,color:"#B0B0B0",marginTop:3}}>Customer Service · 9m ago</div>
            </div>
            <Chev/>
          </div>
        </div>

        {/* Tile: Send us a message */}
        <div onClick={()=>{setWTab("messages");setChatView("new")}} style={{background:"#FFF",border:"1px solid #EBEBEB",borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:"#222"}}>Send us a message</div>
            <div style={{fontFamily:FB,fontSize:12,color:"#B0B0B0",marginTop:3}}>We typically reply in a few minutes</div>
          </div>
          <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${color},${colorD})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
        </div>

        {/* Tile: Search for help + link list */}
        <div style={{background:"#FFF",border:"1px solid #EBEBEB",borderRadius:14,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,borderBottom:"1px solid #F0F0F0",marginBottom:4}}>
            <span style={{fontFamily:FH,fontSize:13,fontWeight:600,color:"#CCC"}}>Search for help</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          {["Pricing","Send custom user attributes","News explained","Forward your email to inbox"].map((t,i,arr)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<arr.length-1?"1px solid #F5F5F5":"none",cursor:"pointer"}}>
              <span style={{fontFamily:FB,fontSize:13.5,color:"#444"}}>{t}</span>
              <Chev/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ===== MESSAGES SCREEN (Header V8 + conversation list) ===== */
  const WMessages=()=>{
    const convos=[
      {msg:"Hi there. I'm Helvion Assistant. How can I...",time:"1d ago",unread:false,av:teamAvatars.slice(0,2)},
      {msg:"Is there anything specific you're looking f...",time:"2d ago",unread:false,av:[teamAvatars[2],teamAvatars[0]]},
      {msg:"👋 Anything I can help with?",time:"4d ago",unread:true,av:[teamAvatars[1],teamAvatars[2]]},
    ];
    if(chatView) return <WChat/>;
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        {/* Header V8: Simple title */}
        <div style={{background:`linear-gradient(135deg,${color},${colorD})`,padding:"20px 20px 18px"}}>
          <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:"#FFF",textAlign:"center"}}>Messages</div>
        </div>
        <div style={{flex:1,background:"#FFF",overflowY:"auto"}}>
          {convos.map((cv,i)=>(
            <div key={i} onClick={()=>setChatView("bot")} style={{display:"flex",alignItems:"center",gap:11,padding:"14px 18px",borderBottom:"1px solid #F3F3F3",cursor:"pointer"}}>
              <AvatarStack items={cv.av} sz={30}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:FB,fontSize:13.5,color:cv.unread?"#111":"#555",fontWeight:cv.unread?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cv.msg}</div>
                <div style={{fontFamily:FB,fontSize:11,color:"#BBB",marginTop:2}}>Customer Service · {cv.time}</div>
              </div>
              {cv.unread?<div style={{width:9,height:9,borderRadius:"50%",background:"#EF4444"}}/>:<Chev clr="#DDD"/>}
            </div>
          ))}
        </div>
        {/* Send button */}
        <div style={{padding:"10px 16px",background:"#FFF",borderTop:"1px solid #F0F0F0"}}>
          <div onClick={()=>setChatView("new")} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",borderRadius:12,background:`linear-gradient(135deg,${color},${colorD})`,cursor:"pointer",boxShadow:`0 4px 16px ${color}25`}}>
            <span style={{fontFamily:FH,fontSize:13,fontWeight:700,color:"#FFF"}}>Send us a message</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
        </div>
      </div>
    );
  };

  /* ===== CHAT SCREEN (Header V4: bot + AI badge, V3: agent with online) ===== */
  const WChat=()=>{
    const msgs=[
      {from:"bot",text:"👋 Hi there! How can I help you today?"},
      {from:"user",text:"Can I change the date of my reservation?"},
      {from:"ai",text:"Yes! You can change your reservation date up to 7 days in advance. Go to \"My Account\" → \"My Reservations\" → select the booking → \"Change Date\".",source:"Changing your reservation date"},
      {from:"user",text:"Could you do it for me instead?"},
      {from:"bot",text:"Of course! Let me connect you with an agent..."},
      {from:"agent",name:"Hannah",text:"Hi there! I'm Hannah.\nHow can I help you today?",online:true},
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        {/* Header V4: back + bot icon + name + AI badge */}
        <div style={{background:`linear-gradient(135deg,${color},${colorD})`,padding:"13px 16px",display:"flex",alignItems:"center",gap:10}}>
          <div onClick={()=>setChatView(null)} style={{cursor:"pointer",display:"flex",padding:2}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </div>
          <BotIcon sz={32}/>
          <div>
            <div style={{fontFamily:FH,fontSize:14.5,fontWeight:700,color:"#FFF"}}>Helvion</div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{display:"inline-flex",padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,.2)",fontFamily:FH,fontSize:9,fontWeight:700,color:"#FFF"}}>AI</span>
              <span style={{fontFamily:FB,fontSize:10,color:"rgba(255,255,255,.6)"}}>Bot</span>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div style={{flex:1,padding:"14px",background:"#FFF",overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          {msgs.map((m,i)=>{
            if(m.from==="user") return(
              <div key={i} style={{alignSelf:"flex-end",maxWidth:"78%"}}>
                <div style={{padding:"10px 16px",borderRadius:"18px 18px 4px 18px",background:`linear-gradient(135deg,${color},${colorD})`,fontFamily:FB,fontSize:13.5,color:"#FFF",lineHeight:1.6}}>{m.text}</div>
                {i===1&&<div style={{fontFamily:FB,fontSize:9.5,color:"#CCC",textAlign:"right",marginTop:4}}>Seen · 2m</div>}
              </div>
            );
            if(m.from==="ai") return(
              <div key={i} style={{display:"flex",gap:8,maxWidth:"84%"}}>
                <BotIcon sz={26}/>
                <div style={{flex:1}}>
                  <div style={{padding:"10px 16px",borderRadius:"4px 18px 18px 18px",background:"#F5F5F7",fontFamily:FB,fontSize:13.5,color:"#333",lineHeight:1.65}}>
                    {m.text}
                    {m.source&&(
                      <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:"#FFF",border:"1px solid #EBEBEB"}}>
                        <div style={{fontFamily:FH,fontSize:9.5,fontWeight:700,color:color}}>Source</div>
                        <div style={{fontFamily:FB,fontSize:11.5,color:"#888",marginTop:2}}>{m.source} ›</div>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:5}}>
                    <AiBadge/><span style={{fontFamily:FB,fontSize:9.5,color:"#CCC"}}>Answer</span>
                  </div>
                </div>
              </div>
            );
            if(m.from==="agent") return(
              <div key={i} style={{display:"flex",gap:8,maxWidth:"84%"}}>
                <Avatar bg={`linear-gradient(135deg,${color},${colorD})`} ini={m.name[0]} sz={28} online={m.online}/>
                <div style={{flex:1}}>
                  <div style={{padding:"10px 16px",borderRadius:"4px 18px 18px 18px",background:"#F5F5F7",fontFamily:FB,fontSize:13.5,color:"#333",lineHeight:1.65,whiteSpace:"pre-line"}}>{m.text}</div>
                  <div style={{fontFamily:FB,fontSize:9.5,color:"#CCC",marginTop:3}}>{m.name} · Just now</div>
                </div>
              </div>
            );
            return(
              <div key={i} style={{display:"flex",gap:8,maxWidth:"84%"}}>
                <BotIcon sz={26}/>
                <div style={{flex:1}}>
                  <div style={{padding:"10px 16px",borderRadius:"4px 18px 18px 18px",background:"#F5F5F7",fontFamily:FB,fontSize:13.5,color:"#333",lineHeight:1.65}}>{m.text}</div>
                  <div style={{fontFamily:FB,fontSize:9.5,color:"#CCC",marginTop:3}}>Bot · Just now</div>
                </div>
              </div>
            );
          })}
          {/* Quick reply buttons */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {["How can you help?","Pricing info"].map((q,i)=>(
              <div key={i} style={{padding:"8px 16px",borderRadius:22,border:`1.5px solid ${color}30`,background:colorL,fontFamily:FH,fontSize:12,fontWeight:600,color:color,cursor:"pointer"}}>{q}</div>
            ))}
          </div>
        </div>

        {/* Reply bar with GIF + emoji + clip */}
        <ReplyBar/>
      </div>
    );
  };

  /* ===== HELP SCREEN (Header V9: title + search bar) ===== */
  const WHelp=()=>{
    const cols=[
      {t:"Getting Started",d:"Everything you need to get going",n:17,emoji:"🚀"},
      {t:"Help Desk",d:"Boost productivity with tools",n:17,emoji:"🎧"},
      {t:"AI Chatbot",d:"Set up your AI assistant",n:12,emoji:"🤖"},
      {t:"Live Chat",d:"Widget setup and customization",n:15,emoji:"💬"},
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        {/* Header V9: Help + search */}
        <div style={{background:`linear-gradient(135deg,${color},${colorD})`,padding:"20px 18px 18px",textAlign:"center"}}>
          <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:"#FFF",marginBottom:12}}>Help</div>
          <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,.2)",borderRadius:11,padding:"10px 14px",backdropFilter:"blur(8px)"}}>
            <span style={{flex:1,fontFamily:FB,fontSize:13,color:"rgba(255,255,255,.7)",textAlign:"left"}}>Search for help</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>
        <div style={{flex:1,background:"#FFF",overflowY:"auto",padding:"8px 0"}}>
          <div style={{fontFamily:FH,fontSize:12,fontWeight:600,color:"#B0B0B0",padding:"8px 18px"}}>{cols.length} collections</div>
          {cols.map((c2,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:"1px solid #F3F3F3",cursor:"pointer"}}>
              <div style={{width:36,height:36,borderRadius:10,background:color+"08",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c2.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:"#222"}}>{c2.t}</div>
                <div style={{fontFamily:FB,fontSize:11.5,color:"#999",marginTop:2}}>{c2.d}</div>
                <div style={{fontFamily:FB,fontSize:10.5,color:"#CCC",marginTop:2}}>{c2.n} articles</div>
              </div>
              <Chev clr="#DDD"/>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ===== NEWS SCREEN (Header V8 + news tiles with chip-news tags) ===== */
  const WNews=()=>{
    const articles=[
      {tags:[{l:"Support",c:color},{l:"New feature",c:"#10B981"}],title:"AI Assistant v2.0 — Multi-Model Support",desc:"Use OpenAI, Gemini and Claude models simultaneously in your workspace."},
      {tags:[{l:"Guide",c:"#8B5CF6"}],title:"Widget Setup Guide 2025",desc:"Add live chat to your website in 5 minutes with our step-by-step guide."},
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        <div style={{background:`linear-gradient(135deg,${color},${colorD})`,padding:"20px 20px 18px",textAlign:"center"}}>
          <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:"#FFF"}}>News</div>
        </div>
        <div style={{flex:1,background:"#F7F7F8",overflowY:"auto",padding:"14px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:"#222"}}>Latest</div>
              <div style={{fontFamily:FB,fontSize:11,color:"#B0B0B0"}}>From Team Helvion</div>
            </div>
            <AvatarStack items={[teamAvatars[0],teamAvatars[1]]} sz={30}/>
          </div>
          {articles.map((a,i)=>(
            <div key={i} style={{background:"#FFF",border:"1px solid #EBEBEB",borderRadius:16,marginBottom:12,overflow:"hidden",cursor:"pointer"}}>
              <div style={{height:100,background:`linear-gradient(135deg,${a.tags[0].c}08,${a.tags[0].c}20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <BotIcon sz={48}/>
              </div>
              <div style={{padding:"14px 16px"}}>
                {/* chip-news tags */}
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {a.tags.map((tag,j)=>(<Chip key={j} label={tag.l} chipColor={tag.c}/>))}
                </div>
                <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:"#222",lineHeight:1.4,marginBottom:5}}>{a.title}</div>
                <div style={{fontFamily:FB,fontSize:12,color:"#888",lineHeight:1.55}}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════
     COMPONENT: Trigger Button (from Trigger.png)
     Open: Chat bubble icon with smile curve
     Closed: Chevron down
     ══════════════════════════════════════ */
  const TriggerButton=()=>(
    <div onClick={()=>setWidgetOpen(!widgetOpen)} style={{position:"fixed",bottom:24,right:24,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${color},${colorD})`,boxShadow:`0 4px 20px ${color}35`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"transform .2s",zIndex:999}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.08)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      {widgetOpen?(
        /* Chevron down (close state) */
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      ):(
        /* Chat bubble with smile (open state) - matching Trigger.png */
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <rect x="5" y="4" width="22" height="18" rx="4" fill="#FFF"/>
          <path d="M12 20l-3 4v-4H9" fill="#FFF"/>
          <path d="M11 14.5c0 0 2.5 2.5 5 2.5s5-2.5 5-2.5" stroke={colorD} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );

  /* ═══════ MAIN RENDER ═══════ */
  return(<>
    <style>{`@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');@keyframes wup{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}*{box-sizing:border-box;margin:0}`}</style>
    <div style={{minHeight:"100vh",background:"#F0ECE6",display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 24px",position:"relative"}}>
      {/* Color picker */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,background:"#FFF",padding:"10px 20px",borderRadius:14,border:"1px solid #E8E8E8",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
        <span style={{fontFamily:FH,fontSize:13,fontWeight:700,color:"#666"}}>Theme:</span>
        <div style={{display:"flex",gap:6}}>
          {colors.map((c2,i)=>(<div key={i} onClick={()=>setColor(c2)} style={{width:26,height:26,borderRadius:7,background:c2,border:color===c2?"2.5px solid #333":"2.5px solid transparent",cursor:"pointer",transition:"all .2s"}}/>))}
        </div>
      </div>

      {/* Widget */}
      {widgetOpen&&(
        <div style={{width:386,maxHeight:660,borderRadius:18,overflow:"hidden",background:"#FFF",boxShadow:"0 20px 60px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.05)",display:"flex",flexDirection:"column",animation:"wup .35s cubic-bezier(.22,1,.36,1) both"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {wTab==="home"&&<WHome/>}
            {wTab==="messages"&&<WMessages/>}
            {wTab==="help"&&<WHelp/>}
            {wTab==="news"&&<WNews/>}
          </div>
          <WNav/>
          <Branding/>
        </div>
      )}

      <TriggerButton/>
    </div>
  </>);
}
