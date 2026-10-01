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

document.addEventListener("DOMContentLoaded", async function () {

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
        jenisTransaksiInput.addEventListener("change", syncTransactionCategory);
        syncTransactionCategory();
    }


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

});


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

function showPage(pageId) {

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


    // Cari tombol berdasarkan onclick
    buttons.forEach(function (button) {

        const onclick =
            button.getAttribute("onclick");

        if (
            onclick &&
            onclick.includes(
                `'${pageId}'`
            )
        ) {

            button.classList.add("active");

        }

    });

}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

    try {

        // Bahan baku
        const {
            count: jumlahBahan,
            error: errorBahan
        } = await supabaseClient
            .from("bahan_baku")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("aktif", true);


        if (errorBahan) {
            throw errorBahan;
        }


        // Barang jadi
        const {
            count: jumlahBarang,
            error: errorBarang
        } = await supabaseClient
            .from("barang_jadi")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("aktif", true);


        if (errorBarang) {
            throw errorBarang;
        }


        // Transaksi masuk
        const {
            data: transaksiMasuk,
            error: errorMasuk
        } = await supabaseClient
            .from("transaksi")
            .select("jumlah")
            .eq("jenis_transaksi", "MASUK");


        if (errorMasuk) {
            throw errorMasuk;
        }


        // Transaksi keluar
        const {
            data: transaksiKeluar,
            error: errorKeluar
        } = await supabaseClient
            .from("transaksi")
            .select("jumlah")
            .eq("jenis_transaksi", "KELUAR");


        if (errorKeluar) {
            throw errorKeluar;
        }


        const totalMasuk =
            (transaksiMasuk || []).reduce(
                (total, item) =>
                    total + Number(item.jumlah),
                0
            );


        const totalKeluar =
            (transaksiKeluar || []).reduce(
                (total, item) =>
                    total + Number(item.jumlah),
                0
            );


        document.getElementById(
            "totalBahanBaku"
        ).textContent =
            jumlahBahan || 0;


        document.getElementById(
            "totalBarangJadi"
        ).textContent =
            jumlahBarang || 0;


        document.getElementById(
            "totalStokMasuk"
        ).textContent =
            totalMasuk;


        document.getElementById(
            "totalStokKeluar"
        ).textContent =
            totalKeluar;


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

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
                    colspan="7"
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


    if (!kode || !nama || !jenis || !satuan) {

        showNotification(
            "Semua data bahan baku harus diisi.",
            "warning"
        );

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
                    satuan: satuan,
                    stok: stok
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
                error
            } = await supabaseClient
                .from("bahan_baku")
                .insert([{
                    kode_bahan: kode,
                    nama_bahan: nama,
                    jenis_bahan: jenis,
                    satuan: satuan,
                    stok: stok
                }]);


            if (error) {
                throw error;
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
                    colspan="9"
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

    document.getElementById("stokBarang").readOnly = false;
    document.querySelector('#formBarangJadi label[for="stokBarang"]').textContent = "Stok Awal";
    document.getElementById("stokBarangHint").textContent =
        "Saldo awal yang sudah tersedia. Untuk membuat stok dari bahan, tambahkan bahan habis pakai lalu catat Produksi.";


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


    try {

        if (editBarangJadiId) {

            const barangLama = dataBarangJadi.find(
                (item) => Number(item.id_barang) === Number(editBarangJadiId)
            );
            const stokAwal = Number(barangLama ? barangLama.stok : 0);
            const perubahanStok = stok - stokAwal;

            if (perubahanStok > 0) {
                const resepProduk = dataResep.filter(
                    (item) => Number(item.id_barang) === Number(editBarangJadiId)
                );

                if (resepProduk.length === 0) {
                    showNotification("Tambahkan bahan habis pakai sebelum menambah stok produksi.", "warning");
                    return;
                }

                if (resepProduk.some((item) => item.bahan_baku && item.bahan_baku.aktif === false)) {
                    showNotification("Perbarui bahan habis pakai yang diarsipkan sebelum produksi.", "warning");
                    return;
                }
            }

            const {
                error
            } = await supabaseClient
                .from("barang_jadi")
                .update({
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    harga_jual: harga
                })
                .eq(
                    "id_barang",
                    editBarangJadiId
                );


            if (error) {
                throw error;
            }

            if (perubahanStok !== 0) {
                const tanggalSekarang = new Date();
                const tanggal = [
                    tanggalSekarang.getFullYear(),
                    String(tanggalSekarang.getMonth() + 1).padStart(2, "0"),
                    String(tanggalSekarang.getDate()).padStart(2, "0")
                ].join("-");

                const { error: transaksiError } = await supabaseClient
                    .from("transaksi")
                    .insert([{
                        tanggal: tanggal,
                        jenis_transaksi: perubahanStok > 0 ? "PRODUKSI" : "KELUAR",
                        keterangan: "Penyesuaian stok dari form Barang Jadi",
                        jumlah: Math.abs(perubahanStok),
                        id_bahan: null,
                        id_barang: editBarangJadiId
                    }]);

                if (transaksiError) {
                    throw transaksiError;
                }
            }


            showNotification(
                perubahanStok === 0
                    ? "Data barang jadi berhasil diperbarui."
                    : "Stok berhasil diperbarui dan dicatat sebagai transaksi.",
                "success"
            );

        } else {

            const {
                error
            } = await supabaseClient
                .from("barang_jadi")
                .insert([{
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    stok: stok,
                    harga_jual: harga
                }]);


            if (error) {
                throw error;
            }


            showNotification(
                "Barang jadi berhasil ditambahkan dengan stok awal.",
                "success"
            );

        }


        closeBarangJadiForm();

        await loadBarangJadi();

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
                "Kode barang sudah digunakan.",
                "error"
            );

        } else {

            const detailError = [error.message, error.details, error.hint]
                .filter(Boolean)
                .join(" ");
            showNotification(detailError || "Gagal menyimpan barang jadi.", "error");

        }

    }

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

    document.getElementById("stokBarang").readOnly = false;
    document.querySelector('#formBarangJadi label[for="stokBarang"]').textContent = "Stok Saat Ini";
    document.getElementById("stokBarangHint").textContent =
        "Jika jumlah dinaikkan, sistem mencatat Produksi dan memakai bahan sesuai resep. Jika diturunkan, sistem mencatat Stok Keluar.";


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
        .select("*, bahan_baku(nama_bahan, satuan, aktif), barang_jadi(nama_barang, kode_barang)")
        .order("id_detail", { ascending: true });

    if (error) {
        console.error("Gagal mengambil resep produksi:", error);
        showNotification(error.message || "Gagal mengambil resep produksi.", "error");
        return;
    }

    dataResep = data || [];
    renderResep();
    populateRecipeOptions();
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
    }

    if (jumlahTransaksi) {
        const step = ["masuk", "bahan_keluar"].includes(jenisTransaksi) ? "0.01" : "1";
        jumlahTransaksi.min = step;
        jumlahTransaksi.step = step;
    }

    createTransactionItemSelect();
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


    existing.innerHTML = `
        <option value="">
            -- Pilih Barang --
        </option>
    `;


    if (jenis === "bahan_baku") {

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


    if (jenis === "barang_jadi") {

        dataBarangJadi.forEach(
            function (item) {

                existing.innerHTML += `

                    <option
                        value="barang-${item.id_barang}">

                        ${escapeHTML(
                            item.kode_barang
                        )}
                        -
                        ${escapeHTML(
                            item.nama_barang
                        )}
                        (Stok: ${item.stok})

                    </option>

                `;

            }
        );

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
                <td colspan="6" class="empty-data">
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

        tabel.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.tanggal)}</td>
                <td><span class="${statusClass}">${escapeHTML(item.jenis_transaksi)}</span></td>
                <td>${escapeHTML(namaBarang)}</td>
                <td>${item.jumlah}</td>
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
                satuan: item.satuan
            };
        }),
        ...dataBarangJadi.map(function (item) {
            return {
                nama: item.nama_barang,
                jenis: "Barang Jadi",
                stok: item.stok,
                satuan: "pcs"
            };
        })
    ];

    if (gabungan.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td colspan="5" class="empty-data">
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
    const keterangan = document.getElementById("keteranganTransaksi").value.trim();

    if (!tanggal || !jenisTransaksi || !jenisBarang || !itemTransaksi || !itemTransaksi.value) {

        showNotification(
            "Mohon lengkapi semua data transaksi.",
            "warning"
        );

        return;
    }

    if (!jumlah || jumlah <= 0) {

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

    if ((jenisBarang === "bahan_baku") !== (tipeItem === "bahan")) {
        showNotification("Jenis barang tidak sesuai dengan jenis transaksi.", "warning");
        return;
    }

    if (! ["masuk", "bahan_keluar"].includes(jenisTransaksi) && !Number.isInteger(jumlah)) {
        showNotification("Jumlah barang jadi harus berupa bilangan bulat.", "warning");
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
        jumlah: jumlah,
        id_bahan: tipeItem === "bahan" ? idItem : null,
        id_barang: tipeItem === "barang" ? idItem : null
    };

    try {

        const { error } = await supabaseClient
            .from("transaksi")
            .insert([payload]);

        if (error) {
            throw error;
        }

        showNotification(
            "Transaksi berhasil disimpan.",
            "success"
        );

        document.getElementById("transaksiForm").reset();

        const tanggalInput = document.getElementById("tanggalTransaksi");
        tanggalInput.value = tanggal;
        createTransactionItemSelect();

        await loadTransaksi();
        await loadBahanBaku();
        await loadBarangJadi();
        await loadPersediaan();
        await loadDashboard();

    } catch (error) {

        console.error(error);

        showNotification(
            error.message || "Gagal menyimpan transaksi. Periksa kembali stok yang tersedia.",
            "error"
        );

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