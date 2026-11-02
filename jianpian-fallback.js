// 荐片兜底播放源 v1.0.0
// 用途: 给聚合实时榜单(TMDB 详情页)补一条播放源。
// 原理: Rex 起播时会把 TMDB 条目的片名/季/集传给所有 type:"stream" 的
// 播放模块。本模块不改动聚合实时榜单原文件, 只在瓜子搜不到时
// 由 Rex 另外调用本模块, 按片名去荐片接口搜, 找到完全同名才返回线路。
// 不改动原模块的好处: 官方更新聚合实时榜单时, 本模块不受影响。
// 限制:
//  - 只做精确片名匹配, 模糊近似标题一律不返回, 避免播错片。
//  - 荐片的剧集是平铺的集数, 没有“第 2 季”这种概念, 所以 season > 1 时返回空。
//  - 电影返回各线路的第一条地址; 剧集返回指定集数的地址。

var WidgetMetadata = {
  id: "muse.jianpian.fallback",
  title: "荐片兜底播放源",
  description: "聚合实时榜单兜底: 瓜子无源时按片名从荐片取线路, 仅精确匹配",
  author: "Muse",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      id: "loadResource",
      title: "荐片兜底",
      description: "按片名从荐片取播放线路",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: []
    }
  ]
};

var API = "https://api.ztcgi.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function qs(obj) {
  var parts = [];
  Object.keys(obj || {}).forEach(function (k) {
    if (obj[k] === undefined || obj[k] === null) return;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

async function apiGet(path) {
  var url = path.indexOf("http") === 0 ? path : API + path;
  var res = await Widget.http.get(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/json,text/plain,*/*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://api.ztcgi.com/"
    }
  });
  var body = res && (res.data !== undefined ? res.data : res);
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return {};
    }
  }
  return body || {};
}

function playHeaders() {
  return {
    "User-Agent": UA,
    Referer: "https://api.ztcgi.com/",
    "X-Forward-Skip-Redirect-Probe": "1"
  };
}

async function loadResource(params) {
  params = params || {};
  // 荐片自己的条目(jp: 开头)走荐片原模块, 这里不抢, 避免重复。
  var link = t(params.link || params.id || "");
  if (link.indexOf("jp:") === 0 || link.indexOf("jpplay:") === 0) return [];

  var title = t(params.seriesName || params.title || params.name || "");
  if (!title) return [];

  var type = t(params.type || params.mediaType || "").toLowerCase();
  var season = parseInt(params.season, 10);
  if (isNaN(season)) season = 0;
  // 荐片没有季的概念, 第 2 季及以上不硬凑, 避免把第 1 季的集数当成第 2 季播。
  if (season > 1) return [];

  var episode = parseInt(params.episode, 10);
  if (isNaN(episode) || episode <= 0) episode = 1;
  var isMovie = type === "movie";

  // 1) 按片名搜荐片, category_id 88 是荐片搜索用的分类, 与原荐片模块一致。
  var searchRes;
  try {
    searchRes = await apiGet(
      "/api/v2/search/videoV2" + qs({ key: title, category_id: 88, page: 1, pageSize: 20 })
    );
  } catch (e) {
    return [];
  }
  var list = (searchRes && searchRes.data) || [];
  if (!list.length) return [];

  // 2) 只认完全同名, 包括 title 和 original_name, 否则不返回。
  var match = null;
  for (var i = 0; i < list.length; i++) {
    var candTitle = t(list[i].title);
    var candOrig = t(list[i].original_name);
    if (candTitle === title || candOrig === title) {
      match = list[i];
      break;
    }
  }
  if (!match) return [];
  var vid = t(match.id);
  if (!vid) return [];

  // 3) 取详情里的播放源列表。
  var detailRes;
  try {
    detailRes = await apiGet("/api/video/detailv2?id=" + encodeURIComponent(vid));
  } catch (e) {
    return [];
  }
  var data = (detailRes && detailRes.data) || {};
  var sources = data.source_list_source || [];
  if (!sources.length) return [];

  // 4) 每条线路取对应集数, 集数超出的线路跳过。
  var out = [];
  for (var s = 0; s < sources.length; s++) {
    var eps = sources[s].source_list || [];
    if (!eps.length) continue;
    var ep;
    if (isMovie) {
      ep = eps[0];
    } else {
      ep = eps[episode - 1];
    }
    if (!ep) continue;
    var url = t(ep.url);
    if (!url || url.indexOf("http") !== 0) continue;
    out.push({
      name: "荐片兜底 · " + (t(sources[s].name) || ("线路" + (s + 1))),
      description: t(data.mask || "") || title,
      url: url,
      playerType: "app",
      customHeaders: playHeaders()
    });
  }
  return out;
}
