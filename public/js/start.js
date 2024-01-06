'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

const base_url = "";
const LEAFLET_DEFAULT_LEVEL = 14;
const MAX_IMAGE_WIDTH = 500;
const MAX_IMAGE_HEIGHT = 500;
const DEFAULT_LAT = 35.45262731924855;
const DEFAULT_LNG = 139.64288856052457;

var main_map;
var main_center_marker_list = [];
var detail_map;

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        all_jisha_list: [],
        filtered_jisha_list: [],
        register_jisha_params: {},
        image_jisha: {},
        info_jisha: {},
        selected_pref: "",
        selected_jisha: "",
        jisha_sort: "",
    },
    computed: {
    },
    methods: {
        select_jisha: async function(){
            if( this.selected_jisha ){
                var jisha = this.all_jisha_list.find(item => item.id == this.selected_jisha);
                main_map.setView([jisha.lat, jisha.lng]);
            }
        },

        start_info_jisha: async function(jisha_id){
            var jisha = this.all_jisha_list.find(item => item.id == jisha_id);
            this.info_jisha = JSON.parse(JSON.stringify(jisha));
            this.info_jisha.image_url = "images/" + jisha.fname + "?p=" + new Date().getTime();
            this.dialog_open('#info_jishia_dialog');
        },

        start_image_jisha: async function(index){
            var jisha = this.filtered_jisha_list[index];
            this.image_jisha = {
                name: jisha.name,
                id: jisha.id,
                image_url: "images/" + jisha.fname + "?p=" + new Date().getTime()
            };
            this.dialog_open('#image_jishia_dialog');
        },

        do_delete_jisha: async function(jisha_id){
            if( !confirm("本当に削除しますか？") )
                return;

            var result = await do_post(base_url + "/jisha-unregister", { id: jisha_id});
            console.log(result);
            this.toast_show("削除しました。");

            await this.update_list();
        },

        update_list: async function(){
            var result = await do_post(base_url + "/jisha-list");
            console.log(result);
            this.all_jisha_list = result.list;

            this.update_main_markers();
            this.filter_jisha_list();
        },

        filter_jisha_list_sort: function(sortby){
            this.jisha_sort = sortby
            this.filter_jisha_list();
        },

        filter_jisha_list: function(){
            var list;
            if( this.selected_pref ){
                list = this.all_jisha_list.filter(item => item.address.pref == this.selected_pref );
            }else{
                list = JSON.parse(JSON.stringify(this.all_jisha_list));
            }
            if( this.jisha_sort ){
                const func = (first, second) =>{
                    if( first < second )    return -1;
                    else if( first == second ) return 0;
                    else return 1;
                };
                list.sort((first, second) =>{
                    if( this.jisha_sort == 'name' )
                        return func(first.name, second.name);
                    else if( this.jisha_sort == 'address')
                        return func(first.address.pref + "_" + first.address.city, second.address.pref + "_" + second.address.city );
                    else if( this.jisha_sort == 'date')
                        return func(first.date, second.date);
                });
            }
            this.filtered_jisha_list = list;

            this.update_main_markers();
        },

        paste_latlng: async function(){
            try{
                var text = await this.clip_paste();
                if( /^\d+(\.\d+)?\s?,\s?\d+(\.\d+)?\s?$/.test(text) ){
                    var latlng = text.split(',');
                    if( latlng.length < 2 )
                        return;
                    var lat = parseFloat(latlng[0]);
                    var lng = parseFloat(latlng[1]);
                    if(isNaN(lat) || isNaN(lng) )
                        return;
                    this.register_jisha_params.lat = lat;
                    this.register_jisha_params.lng = lng;
                }else if( text.startsWith('http://') || text.startsWith('https://')){
                    var result = await do_post(base_url + "/jisha-retrieve-latlng", { url: text });
                    console.log(result);
                    this.register_jisha_params.lat = result.latlng.lat;
                    this.register_jisha_params.lng = result.latlng.lng;
                }else{
                    var result = await do_post(base_url + "/jisha-retrieve-latlng", { pluscode: text });
                    console.log(result);
                    this.register_jisha_params.lat = result.latlng.lat;
                    this.register_jisha_params.lng = result.latlng.lng;
                }
                detail_map.setView([this.register_jisha_params.lat, this.register_jisha_params.lng]);                
            }catch(error){
                console.log(error);
                this.toast_show("ペーストされた文字列は未サポートです。")
            }
        },

        start_register_jisha: async function(){
            document.getElementById('image_file').value = "";
            const toDateStr = (date) =>{
                const to2D = (d) => {
                    return ("0" + d).slice(-2, 2);
                };
                return date.getFullYear() + "-" + to2D(date.getMonth() + 1) + "-" + to2D(date.getDate());
            };
            this.register_jisha_params = {
                type: 'register',
                lat: DEFAULT_LAT,
                lng: DEFAULT_LNG,
                date: toDateStr(new Date())
            };
            detail_map.setView([DEFAULT_LAT, DEFAULT_LNG], LEAFLET_DEFAULT_LEVEL);
            this.dialog_open("#register_jishia_dialog");
            detail_map.invalidateSize();
        },

        do_register_jisha: async function(){
            try{
                this.progress_open();

                var result = await do_post(base_url + "/jisha-register", this.register_jisha_params);
                console.log(result);
                this.dialog_close('#register_jishia_dialog');
                this.toast_show("登録しました。");

                await this.update_list();
            }catch(error){
                console.error(error);
                this.toast_show(error);
            }finally{
                this.progress_close();
            }
        },

        start_update_jisha: async function(index){
            document.getElementById('image_file').value = "";
            var jisha = this.filtered_jisha_list[index];
            this.register_jisha_params = {
                type: 'update',
                id: jisha.id,
                name: jisha.name,
                lat: jisha.lat,
                lng: jisha.lng,
                date: jisha.date,
                url: jisha.url,
                memo: jisha.memo,
            };
            detail_map.setView([this.register_jisha_params.lat, this.register_jisha_params.lng], LEAFLET_DEFAULT_LEVEL);
            this.dialog_open("#register_jishia_dialog");
            detail_map.invalidateSize();
        },

        do_update_jisha: async function(){
            try{
                this.progress_open();

                var result = await do_post(base_url + "/jisha-update", this.register_jisha_params);
                console.log(result);
                this.dialog_close('#register_jishia_dialog');
                this.toast_show("更新しました。");
    
                await this.update_list();
            }catch(error){
                console.error(error);
                this.toast_show(error);
            }finally{
                this.progress_close();
            }
        },

        file_selected: async function(files){
            if( files.length <= 0 ){
                this.register_jisha_params.datarul = null;
                return;
            }

            this.register_jisha_params.dataurl = await resize_image(files[0], MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT);
        },

        update_main_markers: async function(){
            for( const marker of main_center_marker_list ){
                main_map.removeLayer(marker);
            }

            main_center_marker_list = [];
            for( let i = 0 ; i < this.filtered_jisha_list.length ; i++ ){
                let jisha = this.filtered_jisha_list[i];
                let marker = L.marker([jisha.lat, jisha.lng]).addTo(main_map).on('click', (e) => {
                    this.start_info_jisha(jisha.id);
                });
                marker.bindTooltip("<font size='4'>" + escapeHtml(jisha.name) + "</font>");
                main_center_marker_list.push(marker);
            }
        }
    },
    created: function(){
    },
    mounted: function(){
        proc_load();

        detail_map = map_initialize("mapcontainer");
        let detail_center_marker = L.marker([DEFAULT_LAT, DEFAULT_LNG]).addTo(detail_map);
        detail_map.on('click', (e) =>{
            const latlng = e.latlng;
            detail_center_marker.setLatLng(latlng);
            detail_map.setView(latlng);
            this.register_jisha_params.lat = latlng.lat;
            this.register_jisha_params.lng = latlng.lng;
        }).on('move', (e) =>{
            const latlng = detail_map.getCenter();
            detail_center_marker.setLatLng(latlng);
            this.register_jisha_params.lat = latlng.lat;
            this.register_jisha_params.lng = latlng.lng;
        });
        detail_map.setView([DEFAULT_LAT, DEFAULT_LNG], LEAFLET_DEFAULT_LEVEL);

        main_map = map_initialize("main_mapcontainer");
        main_map.setView([DEFAULT_LAT, DEFAULT_LNG], LEAFLET_DEFAULT_LEVEL);

        this.update_list();
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );

async function resize_image(file, max_width, max_height){
    return new Promise((resolve, reject) =>{
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                var x_ratio = image.width / max_width;
                var y_ratio = image.height / max_height;
                console.log(image.width, image.height, x_ratio, y_ratio);
                const ctx = canvas.getContext('2d');
                if( x_ratio <= 1.0 && y_ratio <= 1.0 ){
                    canvas.width = image.width;
                    canvas.height = image.height;
                    ctx.drawImage(image, 0, 0, image.width, image.height );
                }else if( x_ratio > y_ratio ){
                    canvas.width = image.width / x_ratio;
                    canvas.height = image.height / x_ratio;
                    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height );
                }else{
                    canvas.width = image.width / y_ratio;
                    canvas.height = image.height / y_ratio;
                    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height );
                }
                var dataurl = canvas.toDataURL('image/png');
                resolve(dataurl);
            };
            image.onerror = (error) =>{
                reject(error);
            }
            image.src = reader.result;
        };
        reader.onerror = (error) =>{
            resolve(error);
        }
        reader.readAsDataURL(file);
    });
}

function map_initialize(id){
    var map = L.map(id, {
        zoomControl: true,
    });

    L.control.scale({
        imperial: false
    }).addTo(map);

    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
        attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank' rel='noopener noreferrer'>地理院タイル</a>"
    }).addTo(map);

    map.invalidateSize();

    return map;
}

function escapeHtml(str) {
	if (typeof str !== 'string') return str;

	const patterns = {
		'<'  : '&lt;',
		'>'  : '&gt;',
		'&'  : '&amp;',
		'"'  : '&quot;',
		'\'' : '&#x27;',
		'`'  : '&#x60;'
	};

	return str.replace(/[<>&"'`]/g, function(match) {
		return patterns[match];
	});
}