/* =====================================================
   SISTEM PERSEDIAAN TOKO BUTIK
   JavaScript + Supabase
===================================================== */


/* =====================================================
   VARIABEL GLOBAL
===================================================== */

let dataBahanBaku = [];
let dataBarangJadi = [];
let dataResep = [];
let dataTransaksi = [];

let editBahanBakuId = null;
let editBarangJadiId = null;


/* =====================================================
   SAAT HALAMAN DIBUKA
===================================================== */

let activeUserId = null;
let applicationInitialized = false;

document.addEventListener("DOMContentLoaded", async function () {
    const loginForm = document.getElementById("loginForm");
    const logoutButton = document.getElementById("logoutButton");
    const togglePassword = document.getElementById("togglePassword");

    loginForm.addEventListener("submit", signIn);
    logoutButton.addEventListener("click", signOut);
    togglePassword.addEventListener("click", function () {
        const passwordInput = document.getElementById("loginPassword");
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        togglePassword.setAttribute("aria-pressed", String(!isVisible));
        togglePassword.setAttribute(
            "aria-label",
            isVisible ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"
        );
    });

    if (!supabaseClient) {
        setAuthMessage("Koneksi Supabase belum tersedia. Periksa konfigurasi dan koneksi internet.");
        document.getElementById("loginButton").disabled = true;
        return;
    }

    supabaseClient.auth.onAuthStateChange(function (_event, session) {
        setTimeout(function () {
            applyAuthSession(session).catch(function (error) {
                console.error("Gagal menyiapkan sesi:", error);
                showNotification("Gagal menyiapkan sesi akun. Muat ulang halaman dan coba lagi.", "error");
            });
        }, 0);
    });

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Gagal memeriksa sesi:", error);
            setAuthMessage("Sesi tidak dapat diperiksa. Muat ulang halaman dan coba lagi.");
            return;
        }

        await applyAuthSession(session);
    } catch (error) {
        console.error("Gagal memeriksa sesi:", error);
        setAuthMessage("Tidak dapat terhubung ke layanan login. Periksa koneksi internet lalu coba lagi.");
    }
});

async function signIn(event) {
    event.preventDefault();

    const loginButton = document.getElementById("loginButton");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginButton.disabled = true;
    setAuthMessage("");

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Gagal masuk:", error);
            if (error.code === "email_not_confirmed") {
                setAuthMessage("Akun belum dikonfirmasi. Konfirmasi akun di Supabase Authentication → Users.");
            } else if (error.code === "invalid_credentials") {
                setAuthMessage("Supabase menolak email atau kata sandi. Pastikan kata sandi yang dimasukkan adalah kata sandi akun Supabase.");
            } else {
                setAuthMessage("Login gagal: " + error.message);
            }
            return;
        }

        document.getElementById("loginPassword").value = "";
    } catch (error) {
        console.error("Gagal menghubungi layanan login:", error);
        setAuthMessage("Tidak dapat terhubung ke layanan login. Periksa koneksi internet lalu coba lagi.");
    } finally {
        loginButton.disabled = false;
    }
}

async function signOut() {
    const logoutButton = document.getElementById("logoutButton");
    logoutButton.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error("Gagal keluar:", error);
            showNotification("Gagal keluar dari akun. Silakan coba lagi.", "error");
        }
    } catch (error) {
        console.error("Gagal menghubungi layanan autentikasi:", error);
        showNotification("Tidak dapat keluar karena layanan autentikasi tidak terjangkau.", "error");
    } finally {
        logoutButton.disabled = false;
    }
}

async function applyAuthSession(session) {
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");

    if (!session) {
        activeUserId = null;
        applicationInitialized = false;
        appShell.hidden = true;
        authScreen.hidden = false;
        return;
    }

    authScreen.hidden = true;
    appShell.hidden = false;
    document.getElementById("currentUserEmail").textContent = session.user.email || "";

    if (activeUserId === session.user.id && applicationInitialized) {
        return;
    }

    activeUserId = session.user.id;
    applicationInitialized = true;
    await initializeApplication();
}

function setAuthMessage(message) {
    document.getElementById("authMessage").textContent = message;
}

async function initializeApplication() {

    console.log("Sistem Persediaan Toko Butik dimulai...");

    // Tanggal transaksi otomatis hari ini
    const tanggal = document.getElementById("tanggalTransaksi");

    if (tanggal) {

        const today = new Date();

        const year = today.getFullYear();

        const month = String(
            today.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            today.getDate()
        ).padStart(2, "0");

        tanggal.value = `${year}-${month}-${day}`;
    }


    // Buat pilihan barang transaksi
    createTransactionItemSelect();


    // Event jenis barang transaksi
    const jenisBarang =
        document.getElementById(
            "jenisBarangTransaksi"
        );

    if (jenisBarang) {

        jenisBarang.addEventListener(
            "change",
            createTransactionItemSelect
        );
    }

    const jenisTransaksiInput = document.getElementById("jenisTransaksi");

    if (jenisTransaksiInput) {
        jenisTransaksiInput.addEventListener("change", function () {
            document.getElementById("hargaPerolehanTransaksi").value = "";
            document.getElementById("hargaJualTransaksi").value = "";
            document.getElementById("metodePembayaranTransaksi").value = "";
            syncTransactionCategory();
        });
        syncTransactionCategory();
    }

    ["hargaPerolehanTransaksi", "hargaJualTransaksi", "jumlahTransaksi"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
            syncTransactionFields();
            updateTransactionPreview();
        });
    });

    document.getElementById("jenisBarangTransaksi").addEventListener("change", function () {
        createTransactionItemSelect();
        syncTransactionItemDetails();
        updateTransactionPreview();
    });

    document.getElementById("metodePembayaranTransaksi").addEventListener("change", updateTransactionPreview);

    const reportForm = document.getElementById("laporanForm");
    reportForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loadAccountingReport();
    });

    const today = getTodayDateString();
    const monthStart = `${today.slice(0, 7)}-01`;
    document.getElementById("laporanDari").value = monthStart;
    document.getElementById("laporanSampai").value = today;


    // Event form bahan baku
    const bahanForm =
        document.getElementById(
            "bahanBakuForm"
        );

    if (bahanForm) {

        bahanForm.addEventListener(
            "submit",
            saveBahanBaku
        );
    }


    // Event form barang jadi
    const barangForm =
        document.getElementById(
            "barangJadiForm"
        );

    if (barangForm) {

        barangForm.addEventListener(
            "submit",
            saveBarangJadi
        );
    }

    // Event form transaksi
    const transaksiForm =
        document.getElementById(
            "transaksiForm"
        );

    if (transaksiForm) {

        transaksiForm.addEventListener(
            "submit",
            saveTransaksi
        );
    }

    const resepForm = document.getElementById("resepForm");

    if (resepForm) {
        resepForm.addEventListener("submit", saveResep);
    }


    // Load seluruh data
    await loadAllData();

}


/* =====================================================
   LOAD SEMUA DATA
===================================================== */

async function loadAllData() {

    try {

        await loadBahanBaku();

        await loadBarangJadi();

        await loadResep();

        await loadTransaksi();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();

    } catch (error) {

        console.error(
            "Gagal memuat data:",
            error
        );

        showNotification(
            "Gagal memuat data dari Supabase.",
            "error"
        );
    }

}


/* =====================================================
   NAVIGASI HALAMAN
===================================================== */

function showPage(pageId, navId) {

    // Semua halaman disembunyikan
    const pages =
        document.querySelectorAll(".page");

    pages.forEach(function (page) {

        page.classList.remove(
            "active-page"
        );

    });


    // Halaman yang dipilih ditampilkan
    const selectedPage =
        document.getElementById(pageId);

    if (selectedPage) {

        selectedPage.classList.add(
            "active-page"
        );
    }


    // Update tombol navbar
    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );

    buttons.forEach(function (button) {

        button.classList.remove("active");

    });


    // Keep the active menu item distinct when a menu points to a section on another page.
    buttons.forEach(function (button) {
        const activeNavId = navId || pageId;
        button.classList.toggle(
            "active",
            button.dataset.page === pageId &&
            button.dataset.navId === activeNavId
        );
    });

    const pageHeadings = {
        dashboard: [
            "Selamat Datang di Boutique",
            "Kelola persediaan bahan baku dan koleksi butik dalam satu tempat."
        ],
        "bahan-baku": [
            "Master Bahan Baku",
            "Pantau bahan kain, benang, kancing, dan kebutuhan produksi lainnya."
        ],
        "barang-jadi": [
            "Koleksi Barang Jadi",
            "Kelola produk butik, stok siap jual, dan harga pokok setiap koleksi."
        ],
        transaksi: [
            "Aktivitas Persediaan",
            "Catat pembelian bahan, produksi, penjualan langsung, dan saldo persediaan."
        ],
        persediaan: [
            "Ringkasan Persediaan",
            "Lihat jumlah stok dan nilai persediaan bahan baku maupun barang jadi."
        ],
        laporan: [
            "Laporan Akuntansi",
            "Pantau penjualan tunai, HPP, laba kotor, dan jurnal umum butik."
        ]
    };
    const heading = pageHeadings[pageId];
    if (heading) {
        document.getElementById("currentPageTitle").textContent = heading[0];
        document.getElementById("currentPageDescription").textContent = heading[1];
    }

    if (pageId === "laporan") {
        loadAccountingReport();
    }

}

function openBahanHabisPakai() {
    showPage("bahan-baku", "bahan-habis-pakai");

    const section = document.getElementById("bahan-habis-pakai");
    window.scrollTo({
        top: section.getBoundingClientRect().top + window.scrollY - 20
    });
}

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadAccountingReport() {
    const from = document.getElementById("laporanDari").value;
    const through = document.getElementById("laporanSampai").value;
    const journalBody = document.getElementById("tabelJurnal");
    const warning = document.getElementById("laporanPeringatan");

    if (!from || !through || from > through) {
        showNotification("Rentang tanggal laporan tidak valid.", "warning");
        return;
    }

    try {
        const [transactionResult, journalResult, bahanResult, barangResult] = await Promise.all([
            supabaseClient.from("transaksi")
                .select("jenis_transaksi, jumlah, nilai_bahan, nilai_persediaan, nilai_penjualan")
                .gte("tanggal", from)
                .lte("tanggal", through),
            supabaseClient.from("jurnal_umum")
                .select("id_transaksi, tanggal, akun, debit, kredit, keterangan")
                .gte("tanggal", from)
                .lte("tanggal", through)
                .order("tanggal", { ascending: true })
                .order("id_jurnal", { ascending: true }),
            supabaseClient.from("bahan_baku")
                .select("nama_bahan, stok, harga_pokok_rata_rata")
                .eq("aktif", true),
            supabaseClient.from("barang_jadi")
                .select("nama_barang, stok, harga_pokok_rata_rata")
                .eq("aktif", true)
        ]);

        [transactionResult, journalResult, bahanResult, barangResult].forEach(function (result) {
            if (result.error) throw result.error;
        });

        const transactions = transactionResult.data || [];
        const sales = transactions
            .filter((item) => item.jenis_transaksi === "KELUAR")
            .reduce((sum, item) => sum + Number(item.nilai_penjualan || 0), 0);
        const hpp = transactions
            .filter((item) => item.jenis_transaksi === "KELUAR")
            .reduce((sum, item) => sum + Number(item.nilai_persediaan || 0), 0);
        const purchases = transactions
            .filter((item) => item.jenis_transaksi === "MASUK")
            .reduce((sum, item) => sum + Number(item.nilai_persediaan || 0), 0);
        const inventoryItems = [
            ...(bahanResult.data || []).map((item) => ({
                name: item.nama_bahan,
                stock: Number(item.stok),
                unitCost: Number(item.harga_pokok_rata_rata)
            })),
            ...(barangResult.data || []).map((item) => ({
                name: item.nama_barang,
                stock: Number(item.stok),
                unitCost: Number(item.harga_pokok_rata_rata)
            }))
        ];
        const endingInventory = inventoryItems.reduce(
            (sum, item) => sum + item.stock * item.unitCost,
            0
        );
        const unvaluedItems = inventoryItems.filter(
            (item) => item.stock > 0 && item.unitCost <= 0
        );
        const legacySales = transactions.filter(
            (item) => item.jenis_transaksi === "KELUAR" && Number(item.nilai_penjualan || 0) <= 0
        ).length;
        const journal = journalResult.data || [];
        const totalDebit = journal.reduce((sum, item) => sum + Number(item.debit || 0), 0);
        const totalCredit = journal.reduce((sum, item) => sum + Number(item.kredit || 0), 0);

        document.getElementById("laporanPenjualan").textContent = formatRupiah(sales);
        document.getElementById("laporanHpp").textContent = formatRupiah(hpp);
        document.getElementById("laporanLabaKotor").textContent = formatRupiah(sales - hpp);
        document.getElementById("laporanPembelian").textContent = formatRupiah(purchases);
        document.getElementById("laporanNilaiPersediaan").textContent = formatRupiah(endingInventory);
        document.getElementById("totalDebit").textContent = formatRupiah(totalDebit);
        document.getElementById("totalKredit").textContent = formatRupiah(totalCredit);

        const warnings = [];
        if (unvaluedItems.length) {
            warnings.push(
                `Stok tanpa nilai: ${unvaluedItems.map((item) => item.name).join(", ")}. Catat Penilaian Stok Lama sebelum produksi atau penjualan.`
            );
        }
        if (legacySales) {
            warnings.push(`${legacySales} transaksi penjualan lama belum memiliki nilai penjualan/HPP, sehingga laba kotor periode ini belum lengkap.`);
        }
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            warnings.push("Total debit dan kredit jurnal tidak seimbang. Periksa transaksi periode ini.");
        }
        warning.hidden = warnings.length === 0;
        warning.textContent = warnings.join(" ");

        let currentTransactionId = null;
        let transactionGroupIndex = -1;
        journalBody.innerHTML = journal.length
            ? journal.map((item) => {
                if (item.id_transaksi !== currentTransactionId) {
                    currentTransactionId = item.id_transaksi;
                    transactionGroupIndex += 1;
                }
                const rowClass = transactionGroupIndex % 2 === 0
                    ? "journal-entry-start"
                    : "journal-entry-counterpart";

                return `
                    <tr class="${rowClass}">
                        <td>${escapeHTML(item.tanggal)}</td>
                        <td>${escapeHTML(item.akun)}</td>
                        <td>${escapeHTML(item.keterangan || "-")}</td>
                        <td>${formatRupiah(item.debit)}</td>
                        <td>${formatRupiah(item.kredit)}</td>
                    </tr>
                `;
            }).join("")
            : '<tr><td colspan="5" class="empty-data">Belum ada jurnal pada periode ini.</td></tr>';
    } catch (error) {
        console.error("Gagal memuat laporan akuntansi:", error);
        showNotification(error.message || "Gagal memuat laporan akuntansi.", "error");
    }
}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {
    try {
        const now = new Date();
        const today = formatDateForDatabase(now);
        const monthStart = formatDateForDatabase(new Date(now.getFullYear(), now.getMonth(), 1));
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        const activityStart = formatDateForDatabase(sevenDaysAgo);
        const [
            bahanResult,
            barangResult,
            transaksiBulanResult,
            aktivitasResult
        ] = await Promise.all([
            supabaseClient
            .from("bahan_baku")
                .select("id_bahan, nama_bahan, satuan, stok, stok_minimum", { count: "exact" })
                .eq("aktif", true)
                .order("nama_bahan", { ascending: true }),
            supabaseClient
            .from("barang_jadi")
                .select("id_barang, nama_barang, kategori, stok", { count: "exact" })
                .eq("aktif", true)
                .order("nama_barang", { ascending: true }),
            supabaseClient
            .from("transaksi")
                .select("jenis_transaksi, jumlah, id_barang, barang_jadi(nama_barang)")
                .gte("tanggal", monthStart)
                .lte("tanggal", today)
                .order("tanggal", { ascending: false }),
            supabaseClient
            .from("transaksi")
                .select("id_transaksi, tanggal, jenis_transaksi, jumlah, keterangan, bahan_baku(nama_bahan, satuan), barang_jadi(nama_barang)")
                .gte("tanggal", activityStart)
                .lte("tanggal", today)
                .order("tanggal", { ascending: false })
                .order("id_transaksi", { ascending: false })
                .limit(50)
        ]);

        [bahanResult, barangResult, transaksiBulanResult, aktivitasResult].forEach((result) => {
            if (result.error) {
                throw result.error;
            }
        });

        const bahan = bahanResult.data || [];
        const barang = barangResult.data || [];
        const transaksiBulan = transaksiBulanResult.data || [];
        const aktivitas = aktivitasResult.data || [];
        const pergerakanMasuk = transaksiBulan.filter((item) =>
            ["MASUK", "PRODUKSI", "SALDO_AWAL", "PENILAIAN_AWAL"].includes(
                String(item.jenis_transaksi || "").toUpperCase()
            )
        ).length;
        const pergerakanKeluar = transaksiBulan.filter((item) =>
            ["BAHAN_KELUAR", "KELUAR"].includes(
                String(item.jenis_transaksi || "").toUpperCase()
            )
        ).length;

        document.getElementById("totalBahanBaku").textContent = (bahanResult.count || 0).toLocaleString("id-ID");
        document.getElementById("totalBarangJadi").textContent = (barangResult.count || 0).toLocaleString("id-ID");
        document.getElementById("totalStokMasuk").textContent = pergerakanMasuk.toLocaleString("id-ID");
        document.getElementById("totalStokKeluar").textContent = pergerakanKeluar.toLocaleString("id-ID");

        renderDashboardStockChart(bahan);
        renderDashboardCategoryChart(barang);
        renderDashboardLowStock(bahan);
        renderDashboardBestSellers(transaksiBulan);
        renderDashboardActivity(aktivitas);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
        showNotification("Gagal memuat ringkasan dashboard. Periksa koneksi dan izin data.", "error");
    }
}

function formatDateForDatabase(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDashboardQuantity(value) {
    return Number(value || 0).toLocaleString("id-ID", {
        maximumFractionDigits: 2
    });
}

function renderDashboardStockChart(bahan) {
    const container = document.getElementById("dashboardStockChart");
    if (!container) return;

    if (bahan.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada data bahan baku aktif.</p>';
        return;
    }

    const stocks = [...bahan]
        .sort((a, b) => Number(b.stok || 0) - Number(a.stok || 0))
        .slice(0, 5);
    const maximum = Math.max(...stocks.map((item) => Number(item.stok || 0)), 1);

    container.innerHTML = stocks.map((item) => {
        const stock = Number(item.stok || 0);
        const width = Math.max(stock > 0 ? 4 : 0, (stock / maximum) * 100);
        return `
            <div class="stock-chart-row">
                <div class="stock-chart-label">
                    <span>${escapeHTML(item.nama_bahan)}</span>
                    <strong>${formatDashboardQuantity(stock)} ${escapeHTML(item.satuan || "")}</strong>
                </div>
                <div class="stock-chart-track" role="img" aria-label="${escapeHTML(item.nama_bahan)}: ${formatDashboardQuantity(stock)} ${escapeHTML(item.satuan || "")}">
                    <span style="width:${width}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

function renderDashboardCategoryChart(barang) {
    const container = document.getElementById("dashboardCategoryChart");
    if (!container) return;

    if (barang.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada koleksi barang jadi aktif.</p>';
        return;
    }

    const categories = new Map();
    barang.forEach((item) => {
        const category = String(item.kategori || "").trim() || "Belum dikategorikan";
        categories.set(category, (categories.get(category) || 0) + 1);
    });

    const palette = ["#5c1a2e", "#a45b68", "#c49863", "#7d8060", "#796178", "#d7b994"];
    let offset = 0;
    const entries = [...categories.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], index) => {
            const start = offset;
            offset += (count / barang.length) * 100;
            return { name, count, color: palette[index % palette.length], start, end: offset };
        });
    const gradient = entries
        .map((item) => `${item.color} ${item.start}% ${item.end}%`)
        .join(", ");

    container.innerHTML = `
        <div class="category-chart-layout">
            <div class="category-donut" role="img" aria-label="Komposisi ${barang.length} barang jadi berdasarkan kategori" style="background:conic-gradient(${gradient})">
                <span>${barang.length}<small>produk</small></span>
            </div>
            <ul class="category-legend">
                ${entries.map((item) => `
                    <li>
                        <span class="category-swatch" style="--category-color:${item.color}"></span>
                        <span class="category-name">${escapeHTML(item.name)}</span>
                        <strong>${item.count}</strong>
                    </li>
                `).join("")}
            </ul>
        </div>
    `;
}

function renderDashboardLowStock(bahan) {
    const container = document.getElementById("dashboardLowStock");
    if (!container) return;

    const lowStock = bahan
        .filter((item) => Number(item.stok_minimum || 0) > 0 && Number(item.stok || 0) <= Number(item.stok_minimum))
        .sort((a, b) => Number(a.stok || 0) - Number(b.stok || 0));

    if (lowStock.length === 0) {
        container.innerHTML = bahan.length
            ? '<p class="dashboard-empty">Tidak ada bahan yang menyentuh batas minimum.</p>'
            : '<p class="dashboard-empty">Belum ada data bahan baku aktif.</p>';
        return;
    }

    container.innerHTML = lowStock.slice(0, 6).map((item) => `
        <div class="dashboard-list-row low-stock-row">
            <span class="dashboard-alert-dot" aria-hidden="true"></span>
            <span class="dashboard-list-name">${escapeHTML(item.nama_bahan)}</span>
            <strong>${formatDashboardQuantity(item.stok)} ${escapeHTML(item.satuan || "")}</strong>
        </div>
    `).join("");
}

function renderDashboardBestSellers(transaksi) {
    const container = document.getElementById("dashboardBestSellers");
    if (!container) return;

    const products = new Map();
    transaksi
        .filter((item) => String(item.jenis_transaksi || "").toUpperCase() === "KELUAR" && item.id_barang)
        .forEach((item) => {
            const entry = products.get(item.id_barang) || {
                name: item.barang_jadi?.nama_barang || "Barang jadi",
                quantity: 0
            };
            entry.quantity += Number(item.jumlah || 0);
            products.set(item.id_barang, entry);
        });

    const bestSellers = [...products.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    if (bestSellers.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada transaksi penjualan bulan ini.</p>';
        return;
    }

    container.innerHTML = bestSellers.map((item, index) => `
        <div class="dashboard-list-row">
            <span class="best-seller-rank">${index + 1}</span>
            <span class="dashboard-list-name">${escapeHTML(item.name)}</span>
            <strong>${formatDashboardQuantity(item.quantity)} unit</strong>
        </div>
    `).join("");
}

function renderDashboardActivity(aktivitas) {
    const container = document.getElementById("dashboardRecentActivity");
    if (!container) return;

    const labels = {
        MASUK: "Bahan masuk",
        BAHAN_KELUAR: "Bahan keluar",
        PRODUKSI: "Produksi",
        KELUAR: "Penjualan",
        SALDO_AWAL: "Saldo awal",
        PENILAIAN_AWAL: "Penilaian stok"
    };

    if (aktivitas.length === 0) {
        container.innerHTML = '<tr><td class="dashboard-empty" colspan="5">Belum ada aktivitas dalam 7 hari terakhir.</td></tr>';
        return;
    }

    container.innerHTML = aktivitas.slice(0, 10).map((item) => {
        const type = String(item.jenis_transaksi || "").toUpperCase();
        const product = item.barang_jadi?.nama_barang;
        const material = item.bahan_baku?.nama_bahan;
        const itemName = product || material || item.keterangan || "-";
        const unit = product ? "unit" : (item.bahan_baku?.satuan || "");
        const date = item.tanggal
            ? new Date(`${item.tanggal}T00:00:00`).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            })
            : "-";
        return `
            <tr>
                <td>${escapeHTML(date)}</td>
                <td><span class="activity-type activity-${type.toLowerCase()}">${escapeHTML(labels[type] || type)}</span></td>
                <td>${escapeHTML(itemName)}</td>
                <td>${formatDashboardQuantity(item.jumlah)} ${escapeHTML(unit)}</td>
                <td><span class="activity-status">Selesai</span></td>
            </tr>
        `;
    }).join("");
}


/* =====================================================
   BAHAN BAKU
===================================================== */

async function loadBahanBaku() {

    const {
        data,
        error
    } = await supabaseClient
        .from("bahan_baku")
        .select("*")
        .eq("aktif", true)
        .order("id_bahan", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal mengambil bahan baku:",
            error
        );

        showNotification(
            "Gagal mengambil data bahan baku.",
            "error"
        );

        return;
    }


    dataBahanBaku = data || [];

    renderBahanBaku();
    populateRecipeOptions();
}


/* =====================================================
   TAMPILKAN BAHAN BAKU
===================================================== */

function renderBahanBaku(
    data = dataBahanBaku
) {

    const tabel =
        document.getElementById(
            "tabelBahanBaku"
        );

    if (!tabel) {
        return;
    }


    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="empty-data">
                    Belum ada data bahan baku.
                </td>
            </tr>
        `;

        return;
    }


    tabel.innerHTML = "";


    data.forEach(function (item, index) {

        let stokClass =
            "stok-aman";


        if (Number(item.stok) === 0) {

            stokClass =
                "stok-habis";

        } else if (
            Number(item.stok) <= 5
        ) {

            stokClass =
                "stok-sedikit";

        }


        tabel.innerHTML += `

            <tr>

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        item.kode_bahan
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama_bahan
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.jenis_bahan || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.satuan
                    )}
                </td>

                <td
                    class="${stokClass}">
                    ${item.stok}
                </td>

                <td>${formatRupiah(item.harga_pokok_rata_rata)}</td>

                <td>

                    <button
                        class="btn btn-warning btn-small"
                        onclick="editBahanBaku(${item.id_bahan})">

                        Edit

                    </button>


                    <button
                        class="btn btn-danger btn-small"
                        onclick="deleteBahanBaku(${item.id_bahan})">

                        Hapus

                    </button>

                </td>

            </tr>

        `;

    });

}


/* =====================================================
   FORM BAHAN BAKU
===================================================== */

function openBahanBakuForm() {

    editBahanBakuId = null;

    document.getElementById(
        "formBahanBaku"
    ).classList.remove("hidden");


    document.getElementById(
        "bahanBakuForm"
    ).reset();


    document.getElementById(
        "stokBahan"
    ).value = 0;
    document.getElementById("stokBahan").readOnly = false;
    document.getElementById("hargaPokokBahan").value = 0;
    document.getElementById("hargaPokokBahan").readOnly = false;
    document.getElementById("hargaPokokBahanHint").textContent =
        "Saldo awal akan dibuatkan jurnal modal. Stok masuk berikutnya dicatat lewat Transaksi.";


    document.querySelector(
        "#formBahanBaku h3"
    ).textContent =
        "Tambah Bahan Baku";

}


function closeBahanBakuForm() {

    editBahanBakuId = null;

    document.getElementById(
        "formBahanBaku"
    ).classList.add("hidden");

}


/* =====================================================
   SIMPAN BAHAN BAKU
===================================================== */

async function saveBahanBaku(event) {

    event.preventDefault();


    const kode =
        document.getElementById(
            "kodeBahan"
        ).value.trim();


    const nama =
        document.getElementById(
            "namaBahan"
        ).value.trim();


    const jenis =
        document.getElementById(
            "jenisBahan"
        ).value.trim();


    const satuan =
        document.getElementById(
            "satuanBahan"
        ).value;


    const stok =
        Number(
            document.getElementById(
                "stokBahan"
            ).value
        );

    const hargaPokok = Number(document.getElementById("hargaPokokBahan").value);

    if (!kode || !nama || !jenis || !satuan || stok < 0 || hargaPokok < 0) {

        showNotification(
            "Semua data bahan baku harus diisi.",
            "warning"
        );

        return;
    }

    if (!editBahanBakuId && stok > 0 && hargaPokok <= 0) {
        showNotification("Isi harga perolehan per satuan untuk saldo awal bahan.", "warning");
        return;
    }

    try {

        if (editBahanBakuId) {

            // UPDATE

            const {
                error
            } = await supabaseClient
                .from("bahan_baku")
                .update({
                    kode_bahan: kode,
                    nama_bahan: nama,
                    jenis_bahan: jenis,
                    satuan: satuan
                })
                .eq(
                    "id_bahan",
                    editBahanBakuId
                );


            if (error) {
                throw error;
            }


            showNotification(
                "Data bahan baku berhasil diperbarui.",
                "success"
            );

        } else {

            // INSERT

            const {
                data: bahanBaru,
                error
            } = await supabaseClient
                .from("bahan_baku")
                .insert([{
                    kode_bahan: kode,
                    nama_bahan: nama,
                    jenis_bahan: jenis,
                    satuan: satuan,
                    stok: 0,
                    harga_pokok_rata_rata: 0
                }])
                .select("id_bahan")
                .single();


            if (error) {
                throw error;
            }

            if (stok > 0) {
                const { error: openingError } = await supabaseClient
                    .from("transaksi")
                    .insert([{
                        tanggal: getTodayDateString(),
                        jenis_transaksi: "SALDO_AWAL",
                        keterangan: "Saldo awal bahan baku",
                        jumlah: stok,
                        harga_perolehan_satuan: hargaPokok,
                        id_bahan: bahanBaru.id_bahan,
                        id_barang: null
                    }]);

                if (openingError) throw openingError;
            }

            showNotification(
                "Bahan baku berhasil ditambahkan.",
                "success"
            );

        }


        closeBahanBakuForm();

        await loadBahanBaku();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        if (
            error.code === "23505"
        ) {

            showNotification(
                "Kode bahan sudah digunakan.",
                "error"
            );

        } else {

            showNotification(
                "Gagal menyimpan bahan baku.",
                "error"
            );

        }

    }

}


/* =====================================================
   EDIT BAHAN BAKU
===================================================== */

async function editBahanBaku(id) {

    const item =
        dataBahanBaku.find(
            function (data) {
                return data.id_bahan === id;
            }
        );


    if (!item) {
        return;
    }


    editBahanBakuId = id;


    document.getElementById(
        "formBahanBaku"
    ).classList.remove("hidden");


    document.querySelector(
        "#formBahanBaku h3"
    ).textContent =
        "Edit Bahan Baku";


    document.getElementById(
        "kodeBahan"
    ).value =
        item.kode_bahan;


    document.getElementById(
        "namaBahan"
    ).value =
        item.nama_bahan;


    document.getElementById(
        "jenisBahan"
    ).value =
        item.jenis_bahan || "";


    document.getElementById(
        "satuanBahan"
    ).value =
        item.satuan;


    document.getElementById(
        "stokBahan"
    ).value =
        item.stok;

    document.getElementById("stokBahan").readOnly = true;
    document.getElementById("hargaPokokBahan").value = item.harga_pokok_rata_rata || 0;
    document.getElementById("hargaPokokBahan").readOnly = true;
    document.getElementById("hargaPokokBahanHint").textContent =
        "Saldo dan nilai persediaan hanya diubah melalui Transaksi agar jurnal tetap seimbang.";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =====================================================
   HAPUS BAHAN BAKU
===================================================== */

async function deleteBahanBaku(id) {

    const yakin =
        confirm(
            "Bahan yang belum dipakai akan dihapus. Bahan yang punya transaksi atau resep akan diarsipkan agar riwayat tetap aman. Lanjutkan?"
        );


    if (!yakin) {
        return;
    }


    try {

        const [transaksiResult, resepResult] = await Promise.all([
            supabaseClient
                .from("transaksi")
                .select("id_transaksi", { count: "exact", head: true })
                .eq("id_bahan", id),
            supabaseClient
                .from("detail_produksi")
                .select("id_detail", { count: "exact", head: true })
                .eq("id_bahan", id)
        ]);

        if (transaksiResult.error) throw transaksiResult.error;
        if (resepResult.error) throw resepResult.error;
        if (transaksiResult.count === null || resepResult.count === null) {
            throw new Error("Tidak dapat memeriksa transaksi dan resep bahan baku.");
        }

        let diarsipkan = transaksiResult.count > 0 || resepResult.count > 0;

        if (diarsipkan) {
            const { error } = await supabaseClient
                .from("bahan_baku")
                .update({ aktif: false })
                .eq("id_bahan", id);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("bahan_baku")
                .delete()
                .eq("id_bahan", id);

            if (error && error.code === "23503") {
                const { error: archiveError } = await supabaseClient
                    .from("bahan_baku")
                    .update({ aktif: false })
                    .eq("id_bahan", id);

                if (archiveError) throw archiveError;
                diarsipkan = true;
            } else if (error) {
                throw error;
            }
        }


        showNotification(
            diarsipkan
                ? "Bahan baku diarsipkan. Riwayat dan resep lama tetap tersimpan."
                : "Bahan baku berhasil dihapus.",
            "success"
        );


        await loadBahanBaku();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        showNotification(
            error.message || "Gagal menghapus atau mengarsipkan bahan baku.",
            "error"
        );

    }

}


/* =====================================================
   SEARCH BAHAN BAKU
===================================================== */

function searchBahanBaku() {

    const keyword =
        document.getElementById(
            "searchBahanBaku"
        ).value
        .toLowerCase()
        .trim();


    const filtered =
        dataBahanBaku.filter(
            function (item) {

                return (

                    item.kode_bahan
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    item.nama_bahan
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.jenis_bahan || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                );

            }
        );


    renderBahanBaku(filtered);

}


/* =====================================================
   BARANG JADI
===================================================== */

async function loadBarangJadi() {

    const {
        data,
        error
    } = await supabaseClient
        .from("barang_jadi")
        .select("*")
        .eq("aktif", true)
        .order("id_barang", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal mengambil barang jadi:",
            error
        );

        showNotification(
            "Gagal mengambil data barang jadi.",
            "error"
        );

        return;
    }


    dataBarangJadi = data || [];

    renderBarangJadi();
    populateRecipeOptions();

}


/* =====================================================
   TAMPILKAN BARANG JADI
===================================================== */

function renderBarangJadi(
    data = dataBarangJadi
) {

    const tabel =
        document.getElementById(
            "tabelBarangJadi"
        );


    if (!tabel) {
        return;
    }


    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td
                    colspan="11"
                    class="empty-data">
                    Belum ada data barang jadi.
                </td>
            </tr>
        `;

        return;
    }


    tabel.innerHTML = "";


    data.forEach(function (item, index) {

        let stokClass =
            "stok-aman";


        if (Number(item.stok) === 0) {

            stokClass =
                "stok-habis";

        } else if (
            Number(item.stok) <= 5
        ) {

            stokClass =
                "stok-sedikit";

        }


        tabel.innerHTML += `

            <tr>

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        item.kode_barang
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama_barang
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.kategori || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.ukuran || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.warna || "-"
                    )}
                </td>

                <td
                    class="${stokClass}">
                    ${item.stok}
                </td>

                <td>
                    ${formatRupiah(
                        item.harga_jual
                    )}
                </td>

                <td>${Number(item.stok) > 0 || Number(item.harga_pokok_rata_rata) > 0
                    ? formatRupiah(item.harga_pokok_rata_rata)
                    : "-"}</td>

                <td>${formatRecipeUnitCost(getRecipeUnitCost(item.id_barang))}</td>

                <td>

                    <button
                        class="btn btn-warning btn-small"
                        onclick="editBarangJadi(${item.id_barang})">

                        Edit

                    </button>


                    <button
                        class="btn btn-danger btn-small"
                        onclick="deleteBarangJadi(${item.id_barang})">

                        Hapus

                    </button>

                </td>

            </tr>

        `;

    });

}


/* =====================================================
   FORM BARANG JADI
===================================================== */

function openBarangJadiForm() {

    editBarangJadiId = null;


    document.getElementById(
        "formBarangJadi"
    ).classList.remove("hidden");


    document.getElementById(
        "barangJadiForm"
    ).reset();


    document.getElementById(
        "stokBarang"
    ).value = 0;

    document.getElementById("stokBarang").readOnly = true;
    document.querySelector('#formBarangJadi label[for="stokBarang"]').textContent = "Stok Awal";
    document.getElementById("stokBarangHint").textContent =
        "Stok baru bertambah melalui Produksi setelah resep disimpan di menu Bahan Habis Pakai.";


    document.querySelector(
        "#formBarangJadi h3"
    ).textContent =
        "Tambah Barang Jadi";

}


function closeBarangJadiForm() {

    editBarangJadiId = null;

    document.getElementById(
        "formBarangJadi"
    ).classList.add("hidden");

}


/* =====================================================
   SIMPAN BARANG JADI
===================================================== */

async function saveBarangJadi(event) {

    event.preventDefault();

    const kode =
        document.getElementById(
            "kodeBarang"
        ).value.trim();
    const nama =
        document.getElementById(
            "namaBarang"
        ).value.trim();
    const kategori =
        document.getElementById(
            "kategoriBarang"
        ).value.trim();
    const ukuran =
        document.getElementById(
            "ukuranBarang"
        ).value;
    const warna =
        document.getElementById(
            "warnaBarang"
        ).value.trim();
    const stok = Number(document.getElementById("stokBarang").value);
    const harga =
        Number(
            document.getElementById(
                "hargaBarang"
            ).value
        );
    if (
        !kode ||
        !nama ||
        !kategori ||
        !ukuran ||
        !warna ||
        !Number.isInteger(stok) ||
        stok < 0
    ) {
        showNotification(
            "Lengkapi data barang jadi dan isi stok dengan bilangan bulat minimal 0.",
            "warning"
        );
        return;
    }

    if (!editBarangJadiId && stok > 0) {
        showNotification(
            "Simpan barang jadi tanpa stok awal dahulu, lalu tambahkan resep di menu Bahan Habis Pakai.",
            "warning"
        );
        return;
    }

    if (editBarangJadiId) {
        try {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .update({
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    harga_jual: harga
                })
                .eq("id_barang", editBarangJadiId);
            if (error) throw error;

            showNotification("Data barang jadi berhasil diperbarui. Perubahan stok dicatat melalui menu Transaksi.", "success");
        } catch (error) {
            console.error(error);
            showNotification(error.message || "Gagal memperbarui barang jadi.", "error");
            return;
        }
    } else {
        try {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .insert([{
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    stok: 0,
                    harga_pokok_rata_rata: 0,
                    harga_jual: harga
                }]);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            if (error.code === "23505") {
                showNotification("Kode barang sudah digunakan.", "error");
            } else {
                const detailError = [error.message, error.details, error.hint]
                    .filter(Boolean)
                    .join(" ");
                showNotification(detailError || "Gagal menyimpan barang jadi.", "error");
            }
            return;
        }

        showNotification(
            "Barang jadi berhasil disimpan. Tambahkan resep di menu Bahan Habis Pakai; HPP per unit dihitung otomatis.",
            "success"
        );
    }

    closeBarangJadiForm();
    await loadBarangJadi();
    await loadResep();
    await loadPersediaan();
    await loadDashboard();
    createTransactionItemSelect();

}


/* =====================================================
   EDIT BARANG JADI
===================================================== */

async function editBarangJadi(id) {

    const item =
        dataBarangJadi.find(
            function (data) {
                return data.id_barang === id;
            }
        );


    if (!item) {
        return;
    }


    editBarangJadiId = id;


    document.getElementById(
        "formBarangJadi"
    ).classList.remove("hidden");

    document.getElementById("stokBarang").readOnly = true;
    document.querySelector('#formBarangJadi label[for="stokBarang"]').textContent = "Stok Saat Ini";
    document.getElementById("stokBarangHint").textContent =
        "Stok hanya berubah melalui transaksi agar HPP, bahan, dan jurnal tetap terhubung.";


    document.querySelector(
        "#formBarangJadi h3"
    ).textContent =
        "Edit Barang Jadi";


    document.getElementById(
        "kodeBarang"
    ).value =
        item.kode_barang;


    document.getElementById(
        "namaBarang"
    ).value =
        item.nama_barang;


    document.getElementById(
        "kategoriBarang"
    ).value =
        item.kategori || "";


    document.getElementById(
        "ukuranBarang"
    ).value =
        item.ukuran || "";


    document.getElementById(
        "warnaBarang"
    ).value =
        item.warna || "";


    document.getElementById(
        "stokBarang"
    ).value =
        item.stok;


    document.getElementById(
        "hargaBarang"
    ).value =
        item.harga_jual;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =====================================================
   HAPUS BARANG JADI
===================================================== */

async function deleteBarangJadi(id) {

    const yakin =
        confirm(
            "Barang tanpa riwayat transaksi akan dihapus. Barang yang punya riwayat transaksi akan diarsipkan agar histori tetap tersimpan. Lanjutkan?"
        );


    if (!yakin) {
        return;
    }


    try {

        const { count, error: historyError } = await supabaseClient
            .from("transaksi")
            .select("id_transaksi", {
                count: "exact",
                head: true
            })
            .eq("id_barang", id);

        if (historyError) {
            throw historyError;
        }

        if (count === null) {
            throw new Error("Tidak dapat memeriksa riwayat transaksi barang.");
        }

        let diarsipkan = count > 0;

        if (diarsipkan) {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .update({ aktif: false })
                .eq("id_barang", id);

            if (error) {
                throw error;
            }
        } else {
            const { error } = await supabaseClient
            .from("barang_jadi")
            .delete()
            .eq("id_barang", id);

            if (error && error.code === "23503") {
                const { error: archiveError } = await supabaseClient
                    .from("barang_jadi")
                    .update({ aktif: false })
                    .eq("id_barang", id);

                if (archiveError) {
                    throw archiveError;
                }

                diarsipkan = true;
            } else if (error) {
                throw error;
            }
        }

        showNotification(
            diarsipkan
                ? "Barang diarsipkan. Riwayat transaksinya tetap tersimpan."
                : "Barang jadi berhasil dihapus.",
            "success"
        );


        await loadBarangJadi();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        showNotification(
            error.message || "Gagal menghapus atau mengarsipkan barang jadi.",
            "error"
        );

    }

}


/* =====================================================
   SEARCH BARANG JADI
===================================================== */

function searchBarangJadi() {

    const keyword =
        document.getElementById(
            "searchBarangJadi"
        ).value
        .toLowerCase()
        .trim();


    const filtered =
        dataBarangJadi.filter(
            function (item) {

                return (

                    item.kode_barang
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    item.nama_barang
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.kategori || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.warna || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                );

            }
        );


    renderBarangJadi(filtered);

}


async function loadResep() {

    const { data, error } = await supabaseClient
        .from("detail_produksi")
        .select("*, bahan_baku(nama_bahan, satuan, aktif, harga_pokok_rata_rata), barang_jadi(nama_barang, kode_barang)")
        .order("id_detail", { ascending: true });

    if (error) {
        console.error("Gagal mengambil resep produksi:", error);
        showNotification(error.message || "Gagal mengambil resep produksi.", "error");
        return;
    }

    dataResep = data || [];
    renderResep();
    populateRecipeOptions();
    renderBarangJadi();
    createTransactionItemSelect();
}

function getRecipeUnitCost(idBarang) {
    const recipe = dataResep.filter((item) => Number(item.id_barang) === Number(idBarang));
    if (recipe.length === 0) return null;

    let total = 0;
    for (const item of recipe) {
        if (item.bahan_baku && item.bahan_baku.aktif === false) return null;
        const unitCost = Number(item.bahan_baku && item.bahan_baku.harga_pokok_rata_rata || 0);
        if (unitCost <= 0) return null;
        total += Number(item.jumlah_digunakan) * unitCost;
    }

    return total;
}

function formatRecipeUnitCost(value) {
    return value === null
        ? '<span title="Lengkapi resep dan nilai persediaan bahan baku terlebih dahulu">Belum dapat dihitung</span>'
        : formatRupiah(value);
}

function renderResep() {

    const tabel = document.getElementById("tabelResep");
    if (!tabel) return;

    if (dataResep.length === 0) {
        tabel.innerHTML = '<tr><td colspan="5" class="empty-data">Belum ada bahan habis pakai.</td></tr>';
        return;
    }

    tabel.innerHTML = dataResep.map(function (item, index) {
        const barang = item.barang_jadi ? item.barang_jadi.nama_barang : "-";
        const bahan = item.bahan_baku ? item.bahan_baku.nama_bahan : "-";
        const satuan = item.bahan_baku ? item.bahan_baku.satuan : "";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.barang_jadi ? `${item.barang_jadi.kode_barang} - ${barang}` : barang)}</td>
                <td>${escapeHTML(bahan)}</td>
                <td>${escapeHTML(item.jumlah_digunakan)} ${escapeHTML(satuan)}</td>
                <td><button class="btn btn-danger btn-small" onclick="deleteResep(${item.id_detail})">Hapus</button></td>
            </tr>
        `;
    }).join("");
}


function populateRecipeOptions() {

    const barangSelect = document.getElementById("barangResep");
    const bahanSelect = document.getElementById("bahanResep");
    if (!barangSelect || !bahanSelect) return;

    barangSelect.innerHTML = '<option value="">-- Pilih Barang --</option>';
    bahanSelect.innerHTML = '<option value="">-- Pilih Bahan --</option>';

    dataBarangJadi.forEach(function (item) {
        barangSelect.add(new Option(`${item.kode_barang} - ${item.nama_barang}`, item.id_barang));
    });

    dataBahanBaku.forEach(function (item) {
        bahanSelect.add(new Option(`${item.kode_bahan} - ${item.nama_bahan}`, item.id_bahan));
    });
}


async function saveResep(event) {

    event.preventDefault();

    const payload = {
        id_barang: Number(document.getElementById("barangResep").value),
        id_bahan: Number(document.getElementById("bahanResep").value),
        jumlah_digunakan: Number(document.getElementById("jumlahBahanResep").value)
    };

    if (!payload.id_barang || !payload.id_bahan || payload.jumlah_digunakan <= 0) {
        showNotification("Pilih produk, bahan, dan jumlah yang valid.", "warning");
        return;
    }

    const { error } = await supabaseClient
        .from("detail_produksi")
        .insert([payload]);

    if (error) {
        showNotification(
            error.code === "23505"
                ? "Bahan tersebut sudah ada untuk produk ini."
                : error.message || "Gagal menyimpan bahan habis pakai.",
            "error"
        );
        return;
    }

    document.getElementById("resepForm").reset();
    showNotification("Bahan habis pakai berhasil ditambahkan.", "success");
    await loadResep();
}


async function deleteResep(id) {

    if (!confirm("Hapus bahan habis pakai ini dari produk?")) return;

    const { error } = await supabaseClient
        .from("detail_produksi")
        .delete()
        .eq("id_detail", id);

    if (error) {
        showNotification(error.message || "Gagal menghapus bahan habis pakai.", "error");
        return;
    }

    showNotification("Bahan habis pakai berhasil dihapus.", "success");
    await loadResep();
}


function syncTransactionCategory() {

    const jenisTransaksi = document.getElementById("jenisTransaksi").value;
    const jenisBarang = document.getElementById("jenisBarangTransaksi");
    const jumlahTransaksi = document.getElementById("jumlahTransaksi");

    if (["masuk", "bahan_keluar"].includes(jenisTransaksi)) {
        jenisBarang.value = "bahan_baku";
    } else if (["keluar", "produksi"].includes(jenisTransaksi)) {
        jenisBarang.value = "barang_jadi";
    } else if (["saldo_awal", "penilaian_awal"].includes(jenisTransaksi) && !jenisBarang.value) {
        jenisBarang.value = "bahan_baku";
    }

    if (jumlahTransaksi) {
        const step = ["masuk", "bahan_keluar"].includes(jenisTransaksi) ? "0.01" : "1";
        jumlahTransaksi.min = step;
        jumlahTransaksi.step = step;
    }

    createTransactionItemSelect();
    syncTransactionFields();
    updateTransactionPreview();
}

function syncTransactionFields() {
    const type = document.getElementById("jenisTransaksi").value;
    const purchase = type === "masuk";
    const sale = type === "keluar";
    const opening = type === "saldo_awal";
    const valuation = type === "penilaian_awal";
    const purchasePrice = document.getElementById("hargaPerolehanTransaksi");
    const salePrice = document.getElementById("hargaJualTransaksi");
    const payment = document.getElementById("metodePembayaranTransaksi");
    const quantity = document.getElementById("jumlahTransaksi");
    const category = document.getElementById("jenisBarangTransaksi");

    document.getElementById("hargaPerolehanWrapper").hidden = !(purchase || opening || valuation);
    document.querySelector('#hargaPerolehanWrapper label').textContent =
        purchase ? "Harga Beli per Satuan (Rp)" : "Harga Pokok per Satuan (Rp)";
    document.getElementById("hargaJualWrapper").hidden = !sale;
    document.getElementById("metodePembayaranWrapper").hidden = !(purchase || sale);

    purchasePrice.required = purchase || opening || valuation;
    salePrice.required = sale;
    payment.required = purchase || sale;

    const fixedCategory = ["masuk", "bahan_keluar"].includes(type)
        ? "bahan_baku"
        : (["keluar", "produksi"].includes(type) ? "barang_jadi" : null);
    category.disabled = Boolean(fixedCategory);
    if (fixedCategory) category.value = fixedCategory;

    quantity.readOnly = valuation;
    document.querySelector('label[for="jumlahTransaksi"]').textContent =
        valuation ? "Stok Saat Ini (tidak berubah)" : "Jumlah";

}

function syncTransactionItemDetails() {
    const type = document.getElementById("jenisTransaksi").value;
    const picker = document.getElementById("itemTransaksi");
    if (!picker || !picker.value) return;

    if (type === "penilaian_awal") {
        const [itemType, id] = picker.value.split("-");
        const records = itemType === "bahan" ? dataBahanBaku : dataBarangJadi;
        const idField = itemType === "bahan" ? "id_bahan" : "id_barang";
        const record = records.find((item) => String(item[idField]) === id);
        if (record) {
            document.getElementById("jumlahTransaksi").value = record.stok;
            document.getElementById("jumlahTransaksi").min = record.stok || "0";
        }
    } else if (type === "keluar") {
        const id = Number(picker.value.split("-")[1]);
        const record = dataBarangJadi.find((item) => Number(item.id_barang) === id);
        if (record) document.getElementById("hargaJualTransaksi").value = record.harga_jual || "";
    }

    updateTransactionPreview();
}

function updateTransactionPreview() {
    const preview = document.getElementById("nilaiTransaksiPreview");
    if (!preview) return;

    const type = document.getElementById("jenisTransaksi").value;
    const quantity = Number(document.getElementById("jumlahTransaksi").value);
    const purchasePrice = Number(document.getElementById("hargaPerolehanTransaksi").value);
    const salePrice = Number(document.getElementById("hargaJualTransaksi").value);
    const picker = document.getElementById("itemTransaksi");
    const selected = picker && picker.value ? picker.value.split("-") : [];
    const itemId = selected.length === 2 ? Number(selected[1]) : 0;
    const selectedItem = selected[0] === "bahan"
        ? dataBahanBaku.find((item) => Number(item.id_bahan) === itemId)
        : dataBarangJadi.find((item) => Number(item.id_barang) === itemId);

    if (!type) {
        preview.textContent = "Pilih jenis transaksi terlebih dahulu. Kolom nilai dan HPP akan muncul setelah jenis transaksi dipilih.";
        return;
    }

    if (["masuk", "saldo_awal", "penilaian_awal"].includes(type)) {
        const amount = quantity * purchasePrice;
        const label = type === "masuk" ? "Nilai pembelian bahan" : "Nilai persediaan";
        preview.textContent = amount > 0
            ? `${label}: ${formatRupiah(amount)} (${quantity} × ${formatRupiah(purchasePrice)} per satuan)`
            : "Isi jumlah dan harga perolehan per satuan untuk melihat total nilai persediaan.";
        return;
    } else if (type === "bahan_keluar") {
        const unitCost = Number(selectedItem && selectedItem.harga_pokok_rata_rata || 0);
        const amount = quantity * unitCost;
        preview.textContent = amount > 0
            ? `Nilai bahan yang dipakai: ${formatRupiah(amount)} (${quantity} × ${formatRupiah(unitCost)} per satuan)`
            : "Nilai pemakaian bahan belum dapat dihitung. Pilih bahan yang sudah dinilai dan isi jumlah.";
        return;
    } else if (type === "keluar") {
        const revenue = quantity * salePrice;
        const unitCost = Number(selectedItem && selectedItem.harga_pokok_rata_rata || 0);
        if (quantity <= 0 || salePrice <= 0) {
            preview.textContent = "Isi jumlah dan harga jual per unit. Sistem menghitung HPP dari HPP rata-rata barang jadi.";
            return;
        }

        const hpp = unitCost > 0 ? quantity * unitCost : null;
        const grossProfit = hpp === null ? null : revenue - hpp;
        preview.textContent = [
            `Nominal penjualan: ${formatRupiah(revenue)}`,
            hpp === null ? "HPP belum dapat dihitung: nilai stok barang jadi belum tersedia." : `HPP: ${formatRupiah(hpp)}`,
            grossProfit === null ? "" : `Perkiraan laba kotor: ${formatRupiah(grossProfit)}`
        ].filter(Boolean).join(" | ");
        return;
    } else if (type === "produksi") {
        if (quantity <= 0 || !itemId) {
            preview.textContent = "Pilih barang jadi dan isi jumlah produksi. Sistem menghitung nilai bahan sesuai resep sebagai HPP per unit.";
            return;
        }

        const unitMaterialCost = getRecipeUnitCost(itemId);
        if (unitMaterialCost === null) {
            const hasRecipe = dataResep.some((item) => Number(item.id_barang) === itemId);
            preview.textContent = hasRecipe
                ? "HPP produksi belum dapat dihitung. Catat harga perolehan untuk seluruh bahan di resep terlebih dahulu."
                : "HPP produksi belum dapat dihitung. Tambahkan resep bahan untuk barang jadi ini terlebih dahulu.";
            return;
        }

        const materialCost = unitMaterialCost * quantity;
        const unitCost = materialCost / quantity;
        preview.textContent = [
            `Biaya bahan: ${formatRupiah(materialCost)}`,
            `Total nilai produksi: ${formatRupiah(materialCost)}`,
            `Estimasi HPP per unit: ${formatRupiah(unitCost)}`
        ].join(" | ");
        return;
    }

    preview.textContent = "";
}

function getAutoTransactionDescription() {
    const type = document.getElementById("jenisTransaksi").value;
    const quantity = Number(document.getElementById("jumlahTransaksi").value);
    const picker = document.getElementById("itemTransaksi");
    const selected = picker && picker.value ? picker.value.split("-") : [];
    const itemId = selected.length === 2 ? Number(selected[1]) : 0;
    const isMaterial = selected[0] === "bahan";
    const record = isMaterial
        ? dataBahanBaku.find((item) => Number(item.id_bahan) === itemId)
        : dataBarangJadi.find((item) => Number(item.id_barang) === itemId);
    if (!type || !record || quantity <= 0) {
        return "";
    }

    const name = isMaterial ? record.nama_bahan : record.nama_barang;
    const unit = isMaterial ? record.satuan : "unit";
    const quantityText = Number.isInteger(quantity)
        ? String(quantity)
        : String(quantity).replace(".", ",");
    const itemDescription = `${quantityText} ${unit} ${name}`;
    const paymentLabels = {
        TUNAI: "tunai",
        TRANSFER: "transfer",
        QRIS: "QRIS",
        DEBIT: "kartu debit"
    };
    const payment = paymentLabels[
        document.getElementById("metodePembayaranTransaksi").value
    ];
    const descriptions = {
        masuk: `Pembelian bahan baku ${itemDescription}`,
        bahan_keluar: `Pemakaian bahan baku ${itemDescription}`,
        keluar: `Penjualan ${quantityText} ${name}${payment ? ` melalui ${payment}` : ""}`,
        produksi: `Produksi ${quantityText} ${name}`,
        saldo_awal: `Saldo awal persediaan ${itemDescription}`,
        penilaian_awal: `Penilaian stok ${itemDescription}`
    };

    return descriptions[type] || "";
}


/* =====================================================
   MEMBUAT PILIHAN BARANG TRANSAKSI
===================================================== */

function createTransactionItemSelect() {

    const jenisBarang =
        document.getElementById(
            "jenisBarangTransaksi"
        );


    if (!jenisBarang) {
        return;
    }


    let existing =
        document.getElementById(
            "itemTransaksi"
        );


    if (!existing) {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "form-group";


        wrapper.id =
            "itemTransaksiWrapper";


        wrapper.innerHTML = `

            <label for="itemTransaksi">
                Pilih Barang
            </label>

            <select
                id="itemTransaksi"
                required>

                <option value="">
                    -- Pilih Barang --
                </option>

            </select>

        `;


        jenisBarang
            .parentElement
            .after(wrapper);


        existing =
            document.getElementById(
                "itemTransaksi"
            );

    }


    const jenis =
        jenisBarang.value;
    const specialType = ["saldo_awal", "penilaian_awal"].includes(
        document.getElementById("jenisTransaksi").value
    );


    existing.innerHTML = `
        <option value="">
            -- Pilih Barang --
        </option>
    `;


    if (jenis === "bahan_baku" || specialType) {

        dataBahanBaku.forEach(
            function (item) {

                existing.innerHTML += `

                    <option
                        value="bahan-${item.id_bahan}">

                        ${escapeHTML(
                            item.kode_bahan
                        )}
                        -
                        ${escapeHTML(
                            item.nama_bahan
                        )}
                        (Stok: ${item.stok})

                    </option>

                `;

            }
        );

    }


    if (jenis === "barang_jadi" || specialType) {

        dataBarangJadi.forEach(
            function (item) {

                const hasProductionRecipe = dataResep.some(
                    (recipeItem) => Number(recipeItem.id_barang) === Number(item.id_barang)
                );
                const matchingRecipeProduct = !hasProductionRecipe && dataBarangJadi.find(
                    (candidate) =>
                        candidate.nama_barang.trim().toLocaleLowerCase("id-ID") ===
                            item.nama_barang.trim().toLocaleLowerCase("id-ID") &&
                        dataResep.some(
                            (recipeItem) => Number(recipeItem.id_barang) === Number(candidate.id_barang)
                        )
                );
                const recipeStatus = document.getElementById("jenisTransaksi").value === "produksi"
                    ? (hasProductionRecipe
                        ? ""
                        : matchingRecipeProduct
                            ? ` (Resep ada pada ${matchingRecipeProduct.kode_barang})`
                            : " (Resep belum dibuat)")
                    : "";
                const option = document.createElement("option");
                option.value = `barang-${item.id_barang}`;
                option.textContent = `${item.kode_barang} - ${item.nama_barang} (Stok: ${item.stok})${recipeStatus}`;
                option.disabled = document.getElementById("jenisTransaksi").value === "produksi" && !hasProductionRecipe;
                existing.add(option);

            }
        );

    }

    if (!existing.dataset.detailsListener) {
        existing.addEventListener("change", function () {
            syncTransactionItemDetails();
            updateTransactionPreview();
        });
        existing.dataset.detailsListener = "true";
    }

}


/* =====================================================
   UTILITAS: ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   UTILITAS: FORMAT RUPIAH
===================================================== */

function formatRupiah(value) {

    const angka = Number(value) || 0;

    return "Rp " + angka.toLocaleString("id-ID");
}


/* =====================================================
   UTILITAS: NOTIFIKASI
===================================================== */

function showNotification(message, type = "info") {

    const existing = document.querySelector(".notification");

    if (existing) {
        existing.remove();
    }

    const notif = document.createElement("div");

    notif.className = `notification ${type}`;

    notif.textContent = message;

    document.body.appendChild(notif);

    setTimeout(function () {
        notif.remove();
    }, 3000);
}


/* =====================================================
   LOAD TRANSAKSI
===================================================== */

async function loadTransaksi() {

    const {
        data,
        error
    } = await supabaseClient
        .from("transaksi")
        .select(
            "*, bahan_baku(nama_bahan), barang_jadi(nama_barang)"
        )
        .order("id_transaksi", {
            ascending: false
        });

    if (error) {

        console.error(
            "Gagal mengambil transaksi:",
            error
        );

        showNotification(
            "Gagal mengambil data transaksi.",
            "error"
        );

        return;
    }

    dataTransaksi = data || [];

    renderTransaksi();
}


/* =====================================================
   TAMPILKAN TRANSAKSI
===================================================== */

function renderTransaksi(data = dataTransaksi) {

    const tabel = document.getElementById("tabelTransaksi");

    if (!tabel) {
        return;
    }

    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td colspan="10" class="empty-data">
                    Belum ada transaksi.
                </td>
            </tr>
        `;

        return;
    }

    tabel.innerHTML = "";

    data.forEach(function (item, index) {

        const jenis = (item.jenis_transaksi || "").toLowerCase();

        const statusClass = jenis === "masuk"
            ? "status-masuk"
            : (jenis === "produksi" ? "status-produksi" : "status-keluar");

        const namaBarang =
            item.bahan_baku
                ? item.bahan_baku.nama_bahan
                : (item.barang_jadi ? item.barang_jadi.nama_barang : "-");
        const typeLabels = {
            masuk: "Pembelian Bahan",
            bahan_keluar: "Bahan Keluar",
            produksi: "Produksi",
            keluar: "Penjualan",
            saldo_awal: "Saldo Awal",
            penilaian_awal: "Penilaian Saldo Awal"
        };
        const paymentLabels = {
            TUNAI: "Tunai",
            TRANSFER: "Transfer",
            QRIS: "QRIS",
            DEBIT: "Debit"
        };
        const transactionType = (item.jenis_transaksi || "").toUpperCase();
        const cashAmount = transactionType === "KELUAR"
            ? Number(item.nilai_penjualan || 0)
            : (transactionType === "MASUK"
                ? Number(item.nilai_persediaan || 0)
                : (transactionType === "PRODUKSI" ? Number(item.biaya_produksi || 0) : 0));
        const inventoryValue = ["KELUAR", "PRODUKSI", "BAHAN_KELUAR", "SALDO_AWAL", "PENILAIAN_AWAL"]
            .includes(transactionType)
            ? Number(item.nilai_persediaan || 0)
            : null;
        const grossProfit = transactionType === "KELUAR" && cashAmount > 0 && inventoryValue > 0
            ? cashAmount - inventoryValue
            : null;
        const amountText = (amount) => amount > 0 ? formatRupiah(amount) : "-";

        tabel.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.tanggal)}</td>
                <td><span class="${statusClass}">${escapeHTML(typeLabels[jenis] || item.jenis_transaksi)}</span></td>
                <td>${escapeHTML(namaBarang)}</td>
                <td>${escapeHTML(item.jumlah)}</td>
                <td>${amountText(cashAmount)}</td>
                <td>${inventoryValue === null
                    ? "-"
                    : (inventoryValue > 0 ? formatRupiah(inventoryValue) : "Belum dihitung")}</td>
                <td>${grossProfit === null ? "-" : formatRupiah(grossProfit)}</td>
                <td>${escapeHTML(paymentLabels[item.metode_pembayaran] || "-")}</td>
                <td>${escapeHTML(item.keterangan || "-")}</td>
            </tr>
        `;

    });

}


/* =====================================================
   LOAD PERSEDIAAN
===================================================== */

async function loadPersediaan() {

    try {

        // Fetch fresh data bahan baku dari Supabase
        const {
            data: bahanData,
            error: bahanError
        } = await supabaseClient
            .from("bahan_baku")
            .select("*")
            .eq("aktif", true)
            .order("id_bahan", {
                ascending: true
            });

        if (bahanError) {
            throw bahanError;
        }


        // Fetch fresh data barang jadi dari Supabase
        const {
            data: barangData,
            error: barangError
        } = await supabaseClient
            .from("barang_jadi")
            .select("*")
            .eq("aktif", true)
            .order("id_barang", {
                ascending: true
            });

        if (barangError) {
            throw barangError;
        }


        // Update cache global juga biar konsisten
        // dengan halaman Bahan Baku & Barang Jadi
        dataBahanBaku = bahanData || [];
        dataBarangJadi = barangData || [];


        // Baru render
        renderPersediaan();

    } catch (error) {

        console.error(
            "Gagal refresh persediaan:",
            error
        );

        showNotification(
            "Gagal refresh data persediaan.",
            "error"
        );

    }

}


/* =====================================================
   TAMPILKAN PERSEDIAAN
===================================================== */

function renderPersediaan() {

    const tabel = document.getElementById("tabelPersediaan");

    if (!tabel) {
        return;
    }

    const gabungan = [
        ...dataBahanBaku.map(function (item) {
            return {
                nama: item.nama_bahan,
                jenis: "Bahan Baku",
                stok: item.stok,
                satuan: item.satuan,
                unitCost: item.harga_pokok_rata_rata
            };
        }),
        ...dataBarangJadi.map(function (item) {
            return {
                nama: item.nama_barang,
                jenis: "Barang Jadi",
                stok: item.stok,
                satuan: "pcs",
                unitCost: item.harga_pokok_rata_rata
            };
        })
    ];

    if (gabungan.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td colspan="6" class="empty-data">
                    Belum ada data persediaan.
                </td>
            </tr>
        `;

        return;
    }

    tabel.innerHTML = "";

    gabungan.forEach(function (item, index) {

        let stokClass = "stok-aman";

        if (Number(item.stok) === 0) {
            stokClass = "stok-habis";
        } else if (Number(item.stok) <= 5) {
            stokClass = "stok-sedikit";
        }

        tabel.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.nama)}</td>
                <td>${escapeHTML(item.jenis)}</td>
                <td class="${stokClass}">${item.stok}</td>
                <td>${escapeHTML(item.satuan)}</td>
                <td>${formatRupiah(Number(item.stok) * Number(item.unitCost || 0))}</td>
            </tr>
        `;

    });

}


/* =====================================================
   SIMPAN TRANSAKSI
===================================================== */

async function saveTransaksi(event) {

    event.preventDefault();

    const tanggal = document.getElementById("tanggalTransaksi").value;
    const jenisTransaksi = document.getElementById("jenisTransaksi").value;
    const jenisBarang = document.getElementById("jenisBarangTransaksi").value;
    const itemTransaksi = document.getElementById("itemTransaksi");
    const jumlah = Number(document.getElementById("jumlahTransaksi").value);
    const keterangan = getAutoTransactionDescription();
    const hargaPerolehan = Number(document.getElementById("hargaPerolehanTransaksi").value);
    const hargaJual = Number(document.getElementById("hargaJualTransaksi").value);
    const metodePembayaran = document.getElementById("metodePembayaranTransaksi").value;

    if (!tanggal || !jenisTransaksi || !jenisBarang || !itemTransaksi || !itemTransaksi.value) {

        showNotification(
            "Mohon lengkapi semua data transaksi.",
            "warning"
        );

        return;
    }

    if ((!jumlah || jumlah <= 0) && jenisTransaksi !== "penilaian_awal") {

        showNotification(
            "Jumlah transaksi harus lebih dari 0.",
            "warning"
        );

        return;
    }

    if (["masuk", "bahan_keluar"].includes(jenisTransaksi) && jenisBarang !== "bahan_baku") {

        showNotification(
            "Transaksi bahan masuk atau keluar hanya berlaku untuk Bahan Baku.",
            "warning"
        );

        return;
    }

    if (["keluar", "produksi"].includes(jenisTransaksi) && jenisBarang !== "barang_jadi") {

        showNotification(
            "Stok keluar dan produksi hanya berlaku untuk Barang Jadi.",
            "warning"
        );

        return;
    }

    const [tipeItem, idItemStr] = itemTransaksi.value.split("-");
    const idItem = Number(idItemStr);

    const specialType = ["saldo_awal", "penilaian_awal"].includes(jenisTransaksi);
    if (!specialType && ((jenisBarang === "bahan_baku") !== (tipeItem === "bahan"))) {
        showNotification("Jenis barang tidak sesuai dengan jenis transaksi.", "warning");
        return;
    }

    const record = (tipeItem === "bahan" ? dataBahanBaku : dataBarangJadi)
        .find((item) => Number(item[tipeItem === "bahan" ? "id_bahan" : "id_barang"]) === idItem);
    const jumlahTransaksi = jenisTransaksi === "penilaian_awal"
        ? Number(record ? record.stok : 0)
        : jumlah;
    if (!["masuk", "bahan_keluar"].includes(jenisTransaksi) && !Number.isInteger(jumlahTransaksi)) {
        showNotification("Jumlah barang jadi harus berupa bilangan bulat.", "warning");
        return;
    }

    if (jenisTransaksi === "penilaian_awal" && jumlahTransaksi <= 0) {
        showNotification("Pilih barang yang memiliki stok untuk menilai saldo awal.", "warning");
        return;
    }

    if (["masuk", "saldo_awal", "penilaian_awal"].includes(jenisTransaksi) && hargaPerolehan <= 0) {
        showNotification("Masukkan harga perolehan per satuan lebih dari 0.", "warning");
        return;
    }

    if (jenisTransaksi === "keluar" && hargaJual <= 0) {
        showNotification("Masukkan harga jual per unit lebih dari 0.", "warning");
        return;
    }

    if (["masuk", "keluar"].includes(jenisTransaksi) && !metodePembayaran) {
        showNotification("Pilih metode pembayaran.", "warning");
        return;
    }

    if (jenisTransaksi === "produksi") {
        const resepProduk = dataResep.filter((item) => Number(item.id_barang) === idItem);

        if (resepProduk.length === 0) {
            showNotification("Tambahkan bahan habis pakai untuk produk ini terlebih dahulu.", "warning");
            return;
        }

        if (resepProduk.some((item) => item.bahan_baku && item.bahan_baku.aktif === false)) {
            showNotification("Resep memakai bahan yang diarsipkan. Perbarui bahan habis pakai produk ini dulu.", "warning");
            return;
        }
    }

    const payload = {
        tanggal: tanggal,
        jenis_transaksi: jenisTransaksi.toUpperCase(),
        keterangan: keterangan || null,
        jumlah: jumlahTransaksi,
        id_bahan: tipeItem === "bahan" ? idItem : null,
        id_barang: tipeItem === "barang" ? idItem : null,
        harga_perolehan_satuan: ["masuk", "saldo_awal", "penilaian_awal"].includes(jenisTransaksi)
            ? hargaPerolehan
            : null,
        harga_jual_satuan: jenisTransaksi === "keluar" ? hargaJual : null,
        metode_pembayaran: metodePembayaran || null
    };

    try {

        const { error } = await supabaseClient
            .from("transaksi")
            .insert([payload]);

        if (error) {
            throw error;
        }

        const messages = {
            masuk: "Pembelian bahan tercatat; stok dan jurnal pembelian diperbarui.",
            bahan_keluar: "Pemakaian bahan tercatat dan nilai persediaan diperbarui.",
            produksi: "Produksi tercatat; bahan dikurangi, biaya dipindahkan ke barang jadi, dan jurnal dibuat.",
            keluar: "Penjualan tercatat; pembayaran, pendapatan, HPP, stok, dan jurnal diperbarui.",
            saldo_awal: "Saldo awal ditambahkan dan jurnal modal awal dibuat.",
            penilaian_awal: "Nilai stok lama disesuaikan dan jurnal saldo awal dibuat."
        };
        showNotification(messages[jenisTransaksi], "success");

        document.getElementById("transaksiForm").reset();

        const tanggalInput = document.getElementById("tanggalTransaksi");
        tanggalInput.value = tanggal;
        createTransactionItemSelect();
        syncTransactionFields();
        document.getElementById("nilaiTransaksiPreview").textContent = "";

        await loadTransaksi();
        await loadBahanBaku();
        await loadBarangJadi();
        await loadResep();
        await loadPersediaan();
        await loadDashboard();
        if (document.getElementById("laporan").classList.contains("active-page")) {
            await loadAccountingReport();
        }

    } catch (error) {

        console.error(error);

        const message = [error.message, error.details, error.hint].filter(Boolean).join(" ");
        showNotification(message || "Gagal menyimpan transaksi. Periksa nilai transaksi dan ketersediaan stok.", "error");

    }

}



/* =====================================================
   AUTO REFRESH OTOMATIS (POLLING)
   =====================================================
   Fungsi ini otomatis memuat ulang data dari Supabase
   setiap 5 detik, tanpa user perlu klik tombol Refresh.
   
   Yang di-refresh hanya halaman yang sedang aktif,
   jadi tidak boros request ke Supabase.
===================================================== */

let autoRefreshTimer = null;

async function autoRefreshActivePage() {

    if (!activeUserId) {
        return;
    }

    // Jangan refresh kalau tab browser tidak aktif
    // (hemat kuota & resource)
    if (document.hidden) {
        return;
    }


    // Jangan refresh kalau user sedang mengisi form
    // (biar input yang sedang diketik tidak hilang)
    const formBahanBaku = document.getElementById("formBahanBaku");
    const formBarangJadi = document.getElementById("formBarangJadi");
    const resepForm = document.getElementById("resepForm");

    const sedangIsiForm =
        (formBahanBaku && !formBahanBaku.classList.contains("hidden")) ||
        (formBarangJadi && !formBarangJadi.classList.contains("hidden")) ||
        (resepForm && resepForm.contains(document.activeElement));

    if (sedangIsiForm) {
        return;
    }


    // Cari halaman yang sedang aktif
    const halamanAktif = document.querySelector(".page.active-page");

    if (!halamanAktif) {
        return;
    }


    try {

        // Refresh sesuai halaman yang sedang dibuka
        switch (halamanAktif.id) {

            case "dashboard":
                await loadDashboard();
                break;

            case "bahan-baku":
                await loadBahanBaku();
                break;

            case "barang-jadi":
                await loadBarangJadi();
                await loadResep();
                break;

            case "transaksi":
                await loadTransaksi();
                break;

            case "persediaan":
                await loadPersediaan();
                break;

            case "laporan":
                await loadAccountingReport();
                break;

            default:
                break;
        }

    } catch (error) {

        // Kalau gagal refresh, jangan spam notifikasi.
        // Cukup tampilkan di console saja.
        console.warn("Auto refresh gagal:", error);

    }

}


/* =====================================================
   JALANKAN AUTO REFRESH
   =====================================================
   Setiap 5 detik (5000 ms).
   Kalau mau lebih cepat/g lambat, ubah angka 5000:
   - 3000  = 3 detik  (lebih sering, agak boros)
   - 5000  = 5 detik  (rekomendasi)
   - 10000 = 10 detik (lebih hemat)
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    // Bersihkan timer kalau ada (hindari duplikat)
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    autoRefreshTimer = setInterval(
        autoRefreshActivePage,
        5000
    );

    console.log("✅ Auto refresh aktif (tiap 5 detik)");

});